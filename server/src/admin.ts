import { Hono } from 'hono'
import { db } from './firestore.js'
import { requireAdmin } from './auth.js'

const EVENT_TYPES = ['game_start', 'player_added', 'points_added', 'game_ended', 'game_reset'] as const
type EventType = typeof EVENT_TYPES[number]

const RECENT_LIMIT = 50
const LAST_SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const GAME_TARGET_SCORE = 10000
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

const toIso = (value: unknown) => toDate(value)?.toISOString() ?? null

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

const startOfHour = (date: Date) => {
  const d = new Date(date)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}

const slotFromPayload = (payload: Record<string, unknown>) =>
  typeof payload.slot === 'number' && Number.isFinite(payload.slot)
    ? payload.slot
    : null

const playerKey = (slot: number) => `player_${slot}`
const playerLabel = (slot: number) => `Player ${slot + 1}`

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
  let gamesStartedLast7Days = 0
  const nowMs = Date.now()
  const sevenDaysAgoMs = nowMs - LAST_SEVEN_DAYS_MS
  const playerCounts = new Map<number, number>()
  const playerCountValues: number[] = []
  const roundCountValues: number[] = []
  const positiveRoundScores: number[] = []
  const sessionStartTimes = new Map<string, Date>()
  const scoreEventsBySession = new Map<string, {
    id: string
    createdAt: Date
    points: number | null
    slot: number | null
    totalScore: number | null
  }[]>()
  const recent_games: unknown[] = []
  const sessionEventSummaries = new Map<string, {
    inferredEndedAt: Date | null
    maxRoundScore: number
    sawPoints: boolean
  }>()

  allSessions.forEach((d) => {
    const v = d.data()
    const playerCount = typeof v.player_count === 'number' ? v.player_count : 0
    const roundCount = typeof v.rounds === 'number' ? v.rounds : 0
    playerSum += playerCount
    roundsSum += roundCount
    counted += 1
    playerCountValues.push(playerCount)
    roundCountValues.push(roundCount)
    const startedAt = toDate(v.started_at) ?? toDate(v.created_at)
    const startedAtMs = startedAt?.getTime()
    if (startedAt) sessionStartTimes.set(d.id, startedAt)
    if (
      startedAtMs !== undefined &&
      startedAtMs >= sevenDaysAgoMs &&
      startedAtMs <= nowMs
    ) {
      gamesStartedLast7Days += 1
    }
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

      const points = typeof payload.points === 'number' && Number.isFinite(payload.points)
        ? payload.points
        : null
      const recordedTotalScore = totalScore !== null && Number.isFinite(totalScore)
        ? totalScore
        : null
      const slot = slotFromPayload(payload)
      if (createdAt && (recordedTotalScore !== null || (slot !== null && points !== null))) {
        const scoreEvents = scoreEventsBySession.get(v.session_id) ?? []
        scoreEvents.push({
          id: d.id,
          createdAt,
          points,
          slot,
          totalScore: recordedTotalScore,
        })
        scoreEventsBySession.set(v.session_id, scoreEvents)
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

  const completedGameDurationsMs: number[] = []
  scoreEventsBySession.forEach((scoreEvents, sessionId) => {
    const startedAt = sessionStartTimes.get(sessionId)
    if (!startedAt) return

    const startedAtMs = startedAt.getTime()
    const playerTotals = new Map<number, number>()
    const chronologicalEvents = [...scoreEvents]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))

    for (const event of chronologicalEvents) {
      const eventAtMs = event.createdAt.getTime()
      if (eventAtMs < startedAtMs) continue

      let scoreAfterRound = event.totalScore
      if (event.slot !== null && event.points !== null) {
        const calculatedTotal = (playerTotals.get(event.slot) ?? 0) + event.points
        scoreAfterRound ??= calculatedTotal
        playerTotals.set(event.slot, scoreAfterRound)
      }

      if (scoreAfterRound !== null && scoreAfterRound >= GAME_TARGET_SCORE) {
        completedGameDurationsMs.push(eventAtMs - startedAtMs)
        break
      }
    }
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

    if (
      v.type === 'points_added' &&
      typeof payload.points === 'number' &&
      Number.isFinite(payload.points) &&
      payload.points > 0
    ) {
      positiveRoundScores.push(payload.points)
    }

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
    avg_score_per_round: average(positiveRoundScores),
    avg_game_time_ms: completedGameDurationsMs.length ? average(completedGameDurationsMs) : null,
    median_players_per_game: median(playerCountValues),
    median_rounds_per_game: median(roundCountValues),
    median_score_per_round: median(positiveRoundScores),
    median_game_time_ms: completedGameDurationsMs.length ? median(completedGameDurationsMs) : null,
    games_started_last_7_days: gamesStartedLast7Days,
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
}).get('/sessions/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const sessionsCol = db().collection('sessions')
  const eventsCol = db().collection('events')

  const [sessionSnap, eventSnaps] = await Promise.all([
    sessionsCol.doc(sessionId).get(),
    eventsCol.where('session_id', '==', sessionId).get(),
  ])

  if (!sessionSnap.exists && eventSnaps.empty) {
    return c.json({ error: 'not found' }, 404)
  }

  const session = sessionSnap.exists ? sessionSnap.data()! : {}
  const storedPlayerCount = typeof session.player_count === 'number' ? session.player_count : 0
  const maxPoints = typeof session.max_points === 'number' ? session.max_points : 10000
  const slots = new Set<number>()
  for (let slot = 0; slot < storedPlayerCount; slot += 1) slots.add(slot)

  const events = eventSnaps.docs
    .map((d) => {
      const v = d.data()
      const payload = v.payload && typeof v.payload === 'object'
        ? v.payload as Record<string, unknown>
        : {}
      const createdAt = toDate(v.created_at)
      const slot = slotFromPayload(payload)
      if (slot !== null) slots.add(slot)

      return {
        id: d.id,
        type: typeof v.type === 'string' ? v.type : 'unknown',
        created_at: createdAt?.toISOString() ?? null,
        timestamp: createdAt?.getTime() ?? 0,
        payload,
      }
    })
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))

  const slotList = [...slots].sort((a, b) => a - b)
  const totals = new Map(slotList.map((slot) => [slot, 0]))
  const playerRounds = new Map(slotList.map((slot) => [slot, 0]))
  const playerTopRound = new Map(slotList.map((slot) => [slot, null as number | null]))
  const playerLowestRound = new Map(slotList.map((slot) => [slot, null as number | null]))
  const scoreEvents: {
    created_at: string | null
    timestamp: number
    points: number
    slot: number
    total_score: number
  }[] = []
  const timeline: Record<string, number | string | null>[] = []

  const firstEventAt = events.find((event) => event.created_at)?.created_at ?? null
  const startedAt = toIso(session.started_at) ?? toIso(session.created_at) ?? firstEventAt
  const createdAt = toIso(session.created_at) ?? startedAt
  const lastEventAt = toIso(session.last_event_at) ?? [...events].reverse().find((event) => event.created_at)?.created_at ?? null

  const makeTimelinePoint = (
    created_at: string | null,
    timestamp: number,
    round: number,
    slot: number | null,
    points: number | null,
  ) => {
    const point: Record<string, number | string | null> = {
      timestamp,
      created_at,
      round,
      event_slot: slot,
      event_player: slot === null ? null : playerLabel(slot),
      event_points: points,
    }
    slotList.forEach((playerSlot) => {
      point[playerKey(playerSlot)] = totals.get(playerSlot) ?? 0
    })
    return point
  }

  if (startedAt) {
    timeline.push(makeTimelinePoint(startedAt, new Date(startedAt).getTime(), 0, null, null))
  }

  events.forEach((event) => {
    if (event.type !== 'points_added') return
    const slot = slotFromPayload(event.payload)
    const points = typeof event.payload.points === 'number' ? event.payload.points : null
    if (slot === null || points === null) return
    if (!totals.has(slot)) {
      totals.set(slot, 0)
      playerRounds.set(slot, 0)
      playerTopRound.set(slot, null)
      playerLowestRound.set(slot, null)
    }

    const totalScore = (totals.get(slot) ?? 0) + points
    totals.set(slot, totalScore)
    playerRounds.set(slot, (playerRounds.get(slot) ?? 0) + 1)
    playerTopRound.set(slot, Math.max(playerTopRound.get(slot) ?? points, points))
    playerLowestRound.set(slot, Math.min(playerLowestRound.get(slot) ?? points, points))

    scoreEvents.push({
      created_at: event.created_at,
      timestamp: event.timestamp,
      points,
      slot,
      total_score: totalScore,
    })
    timeline.push(makeTimelinePoint(
      event.created_at,
      event.timestamp,
      scoreEvents.length,
      slot,
      points,
    ))
  })

  const roundDeltas = scoreEvents
    .map((event, i) => i === 0 ? null : event.timestamp - scoreEvents[i - 1].timestamp)
    .filter((value): value is number => typeof value === 'number' && value >= 0)
  const avgRoundDelta = roundDeltas.length
    ? roundDeltas.reduce((sum, value) => sum + value, 0) / roundDeltas.length
    : null
  const inferredEndedAt = scoreEvents.find((event) => event.total_score >= maxPoints)?.created_at ?? null
  const endedAt = toIso(session.ended_at)
    ?? events.find((event) => event.type === 'game_ended')?.created_at
    ?? events.find((event) => event.type === 'game_reset')?.created_at
    ?? inferredEndedAt
  const startedMs = startedAt ? new Date(startedAt).getTime() : null
  const endedMs = endedAt ? new Date(endedAt).getTime() : null
  const durationMs = startedMs !== null && endedMs !== null && endedMs >= startedMs
    ? endedMs - startedMs
    : null

  const players = [...new Set([...slotList, ...totals.keys()])]
    .sort((a, b) => a - b)
    .map((slot) => ({
      slot,
      key: playerKey(slot),
      label: playerLabel(slot),
      total_score: totals.get(slot) ?? 0,
      rounds: playerRounds.get(slot) ?? 0,
      top_round_score: playerTopRound.get(slot),
      lowest_round_score: playerLowestRound.get(slot),
    }))

  const sortedScores = [...scoreEvents].sort((a, b) => b.points - a.points)

  return c.json({
    session_id: sessionId,
    summary: {
      player_count: players.length || storedPlayerCount,
      rounds: scoreEvents.length,
      max_score: scoreEvents.reduce((max, event) => Math.max(max, event.points), 0),
      max_points: maxPoints,
      top_score: players.length ? Math.max(...players.map((player) => player.total_score)) : 0,
      lowest_score: players.length ? Math.min(...players.map((player) => player.total_score)) : 0,
      started_at: startedAt,
      ended_at: endedAt,
      created_at: createdAt,
      last_event_at: lastEventAt,
      duration_ms: durationMs,
      avg_time_between_rounds_ms: avgRoundDelta,
      shortest_time_between_rounds_ms: roundDeltas.length ? Math.min(...roundDeltas) : null,
      longest_time_between_rounds_ms: roundDeltas.length ? Math.max(...roundDeltas) : null,
    },
    players,
    top_rounds: sortedScores.slice(0, 5).map((event) => ({
      slot: event.slot,
      label: playerLabel(event.slot),
      points: event.points,
      total_score: event.total_score,
      created_at: event.created_at,
    })),
    lowest_rounds: [...scoreEvents]
      .sort((a, b) => a.points - b.points)
      .slice(0, 5)
      .map((event) => ({
        slot: event.slot,
        label: playerLabel(event.slot),
        points: event.points,
        total_score: event.total_score,
        created_at: event.created_at,
      })),
    timeline,
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      created_at: event.created_at,
      payload: event.payload,
    })),
  })
})
