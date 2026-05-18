import { Hono } from 'hono'
import { db } from './firestore.js'
import { requireAdmin } from './auth.js'

const POINTS_BUCKETS: [string, (n: number) => boolean][] = [
  ['0', (n) => n === 0],
  ['1-99', (n) => n > 0 && n < 100],
  ['100-249', (n) => n >= 100 && n < 250],
  ['250-499', (n) => n >= 250 && n < 500],
  ['500-999', (n) => n >= 500 && n < 1000],
  ['1000+', (n) => n >= 1000],
]

const RECENT_LIMIT = 50
const POINTS_SAMPLE = 500

export const adminRoute = new Hono().use('*', requireAdmin).get('/stats', async (c) => {
  const sessionsCol = db().collection('sessions')
  const eventsCol = db().collection('events')

  const [totalGamesAgg, totalEventsAgg] = await Promise.all([
    sessionsCol.count().get(),
    eventsCol.count().get(),
  ])

  const recentSessions = await sessionsCol
    .orderBy('last_event_at', 'desc')
    .limit(RECENT_LIMIT)
    .get()

  let playerSum = 0
  let roundsSum = 0
  let counted = 0
  const recent_games: unknown[] = []

  recentSessions.forEach((d) => {
    const v = d.data()
    playerSum += v.player_count ?? 0
    roundsSum += v.rounds ?? 0
    counted += 1
    recent_games.push({
      session_id: d.id,
      player_count: v.player_count ?? 0,
      rounds: v.rounds ?? 0,
      max_score: v.max_score ?? 0,
      ended_at: v.ended_at?.toDate?.()?.toISOString?.() ?? null,
    })
  })

  const pointsSnap = await eventsCol
    .where('type', '==', 'points_added')
    .orderBy('created_at', 'desc')
    .limit(POINTS_SAMPLE)
    .get()

  const distribution = POINTS_BUCKETS.map(([bucket]) => ({ bucket, count: 0 }))
  pointsSnap.forEach((d) => {
    const p = d.data().payload?.points
    if (typeof p !== 'number') return
    for (let i = 0; i < POINTS_BUCKETS.length; i++) {
      if (POINTS_BUCKETS[i][1](p)) {
        distribution[i].count += 1
        break
      }
    }
  })

  return c.json({
    total_games: totalGamesAgg.data().count,
    total_events: totalEventsAgg.data().count,
    avg_players_per_game: counted ? playerSum / counted : 0,
    avg_rounds_per_game: counted ? roundsSum / counted : 0,
    points_distribution: distribution,
    recent_games,
  })
})
