import { Hono } from 'hono'
import { db } from './firestore.js'
import { requireAdmin } from './auth.js'

const EVENT_TYPES = ['game_start', 'player_added', 'points_added', 'game_ended', 'game_reset'] as const
type EventType = typeof EVENT_TYPES[number]

const RECENT_LIMIT = 50
const EVENT_VALUE_BOUNDS: Record<EventType, {
  min: number
  max: number
  value_label: string
}> = {
  game_start: { min: 0, max: 10000, value_label: 'Max points' },
  player_added: { min: 1, max: 10, value_label: 'Player slot' },
  points_added: { min: 0, max: 2000, value_label: 'Points' },
  game_ended: { min: 0, max: 10000, value_label: 'Ending score' },
  game_reset: { min: 0, max: 10000, value_label: 'Max score' },
}

const isEventType = (value: unknown): value is EventType =>
  typeof value === 'string' && EVENT_TYPES.includes(value as EventType)

const emptyEventCounts = () =>
  EVENT_TYPES.reduce(
    (acc, type) => {
      acc[type] = 0
      return acc
    },
    {} as Record<EventType, number>,
  )

const toDate = (value: unknown): Date | null => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate()
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

const startOfHour = (date: Date) => {
  const d = new Date(date)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}

const eventValue = (type: EventType, payload: Record<string, unknown>) => {
  if (type === 'game_start') {
    return typeof payload.max_points === 'number' ? payload.max_points : 10000
  }
  if (type === 'player_added') {
    return typeof payload.slot === 'number' ? payload.slot + 1 : null
  }
  if (type === 'points_added') {
    return typeof payload.points === 'number' ? payload.points : null
  }
  if (type === 'game_ended') {
    return typeof payload.ending_score === 'number' ? payload.ending_score : null
  }
  if (type === 'game_reset') {
    return typeof payload.max_score === 'number' ? payload.max_score : null
  }
  return null
}

const clampedValue = (type: EventType, value: number) => {
  const bounds = EVENT_VALUE_BOUNDS[type]
  return Math.max(bounds.min, Math.min(bounds.max, value))
}

export const adminRoute = new Hono().use('*', requireAdmin).get('/stats', async (c) => {
  const sessionsCol = db().collection('sessions')
  const eventsCol = db().collection('events')

  const [
    totalGamesAgg,
    totalEventsAgg,
    allEvents,
    allSessions,
    ...eventTypeAggs
  ] = await Promise.all([
    sessionsCol.count().get(),
    eventsCol.count().get(),
    eventsCol.orderBy('created_at', 'desc').get(),
    sessionsCol.get(),
    ...EVENT_TYPES.map((type) => eventsCol.where('type', '==', type).count().get()),
  ])

  const recentSessions = await sessionsCol
    .orderBy('last_event_at', 'desc')
    .limit(RECENT_LIMIT)
    .get()

  let playerSum = 0
  let roundsSum = 0
  let counted = 0
  const playerCounts = new Map<number, number>()
  const recent_games: unknown[] = []
  const sessionEventSummaries = new Map<string, {
    inferredEndedAt: Date | null
    maxRoundScore: number
    sawPoints: boolean
  }>()

  allSessions.forEach((d) => {
    const v = d.data()
    const playerCount = typeof v.player_count === 'number' ? v.player_count : 0
    playerSum += playerCount
    roundsSum += typeof v.rounds === 'number' ? v.rounds : 0
    counted += 1
    if (playerCount > 0) {
      playerCounts.set(playerCount, (playerCounts.get(playerCount) ?? 0) + 1)
    }
  })

  allEvents.forEach((d) => {
    const v = d.data()
    if (typeof v.session_id !== 'string') return

    const payload = v.payload && typeof v.payload === 'object'
      ? v.payload as Record<string, unknown>
      : {}
    const createdAt = toDate(v.created_at)
    const summary = sessionEventSummaries.get(v.session_id) ?? {
      inferredEndedAt: null,
      maxRoundScore: 0,
      sawPoints: false,
    }

    if (v.type === 'points_added') {
      summary.sawPoints = true
      if (typeof payload.points === 'number') {
        summary.maxRoundScore = Math.max(summary.maxRoundScore, payload.points)
      }

      const totalScore = typeof payload.total_score === 'number' ? payload.total_score : null
      const maxPoints = typeof payload.max_points === 'number' ? payload.max_points : 10000
      if (!summary.inferredEndedAt && createdAt && totalScore !== null && totalScore >= maxPoints) {
        summary.inferredEndedAt = createdAt
      }
    } else if (
      !summary.inferredEndedAt &&
      createdAt &&
      (v.type === 'game_ended' || v.type === 'game_reset')
    ) {
      summary.inferredEndedAt = createdAt
    }

    sessionEventSummaries.set(v.session_id, summary)
  })

  recentSessions.forEach((d) => {
    const v = d.data()
    const eventSummary = sessionEventSummaries.get(d.id)
    const storedMaxScore = typeof v.max_score === 'number' ? v.max_score : 0
    const maxPoints = typeof v.max_points === 'number' ? v.max_points : 10000
    const maxScore = eventSummary?.sawPoints ? eventSummary.maxRoundScore : storedMaxScore
    const startedAt = toDate(v.started_at) ?? toDate(v.created_at)
    const endedAt =
      toDate(v.ended_at) ??
      eventSummary?.inferredEndedAt ??
      (storedMaxScore >= maxPoints ? toDate(v.last_event_at) : null)
    recent_games.push({
      session_id: d.id,
      player_count: v.player_count ?? 0,
      rounds: v.rounds ?? 0,
      max_score: maxScore,
      started_at: startedAt?.toISOString() ?? null,
      ended_at: endedAt?.toISOString() ?? null,
    })
  })

  const event_type_counts = EVENT_TYPES.map((type, i) => ({
    type,
    count: eventTypeAggs[i].data().count,
  }))

  const eventsByHour = new Map<string, Record<EventType, number> & { hour: string; total: number }>()
  const hourOfDay = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
    total: 0,
    ...emptyEventCounts(),
  }))
  const raw_events: {
    id: string
    type: EventType
    created_at: string
    value: number
    display_value: number
    is_clipped: boolean
  }[] = []
  let eventWindowStart: string | null = null
  let eventWindowEnd: string | null = null

  allEvents.forEach((d) => {
    const v = d.data()
    if (!isEventType(v.type)) return

    const createdAt = toDate(v.created_at)
    const payload = v.payload && typeof v.payload === 'object'
      ? v.payload as Record<string, unknown>
      : {}

    if (createdAt) {
      const hour = startOfHour(createdAt)
      const bucket = eventsByHour.get(hour) ?? {
        hour,
        total: 0,
        ...emptyEventCounts(),
      }
      bucket[v.type] += 1
      bucket.total += 1
      eventsByHour.set(hour, bucket)

      const byHour = hourOfDay[createdAt.getUTCHours()]
      byHour[v.type] += 1
      byHour.total += 1

      const iso = createdAt.toISOString()
      if (!eventWindowStart || iso < eventWindowStart) eventWindowStart = iso
      if (!eventWindowEnd || iso > eventWindowEnd) eventWindowEnd = iso

      const value = eventValue(v.type, payload)
      if (typeof value === 'number') {
        const displayValue = clampedValue(v.type, value)
        raw_events.push({
          id: d.id,
          type: v.type,
          created_at: iso,
          value,
          display_value: displayValue,
          is_clipped: displayValue !== value,
        })
      }
    }

  })

  const player_count_distribution = [...playerCounts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([player_count, count]) => ({
      player_count,
      label: player_count === 1 ? '1 player' : `${player_count} players`,
      count,
    }))

  return c.json({
    total_games: totalGamesAgg.data().count,
    total_events: totalEventsAgg.data().count,
    avg_players_per_game: counted ? playerSum / counted : 0,
    avg_rounds_per_game: counted ? roundsSum / counted : 0,
    event_type_counts,
    events_over_time: [...eventsByHour.values()].sort((a, b) => a.hour.localeCompare(b.hour)),
    events_by_hour_of_day: hourOfDay,
    raw_events: raw_events.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    event_value_bounds: EVENT_VALUE_BOUNDS,
    player_count_distribution,
    recent_games,
    event_data_size: allEvents.size,
    event_window_start: eventWindowStart,
    event_window_end: eventWindowEnd,
  })
})
