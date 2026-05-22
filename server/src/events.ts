import { Hono } from 'hono'
import { z } from 'zod'
import { FieldValue } from '@google-cloud/firestore'
import { db } from './firestore.js'

const EventBody = z.object({
  session_id: z.string().uuid(),
  type: z.enum(['game_start', 'player_added', 'points_added', 'game_ended', 'game_reset']),
  payload: z.record(z.unknown()).default({}),
})

const RATE_LIMIT = 60
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

const allow = (ip: string): boolean => {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return false
  recent.push(now)
  hits.set(ip, recent)
  return true
}

const updateSessionSummary = async (
  sessionId: string,
  type: z.infer<typeof EventBody>['type'],
  payload: Record<string, unknown>,
) => {
  const ref = db().collection('sessions').doc(sessionId)
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const cur = snap.exists ? snap.data()! : {
      player_count: 0,
      rounds: 0,
      max_score: 0,
      max_points: 10000,
      created_at: FieldValue.serverTimestamp(),
    }

    const next: Record<string, unknown> = {
      ...cur,
      last_event_at: FieldValue.serverTimestamp(),
    }
    if (!cur.started_at) {
      next.started_at = cur.created_at ?? FieldValue.serverTimestamp()
    }

    if (type === 'game_start') {
      next.max_points = typeof payload.max_points === 'number' ? payload.max_points : cur.max_points
    } else if (type === 'player_added') {
      next.player_count = (cur.player_count ?? 0) + 1
    } else if (type === 'points_added') {
      next.rounds = (cur.rounds ?? 0) + 1
      const p = typeof payload.points === 'number' ? payload.points : 0
      const totalScore = typeof payload.total_score === 'number' ? payload.total_score : p
      const maxPoints = typeof payload.max_points === 'number' ? payload.max_points : cur.max_points ?? 10000
      next.max_score = Math.max(cur.max_score ?? 0, totalScore)
      if (!cur.ended_at && totalScore >= maxPoints) {
        next.ended_at = FieldValue.serverTimestamp()
      }
      if (typeof payload.player_count === 'number') next.player_count = payload.player_count
      if (typeof payload.max_points === 'number') next.max_points = payload.max_points
    } else if (type === 'game_ended') {
      next.ended_at = FieldValue.serverTimestamp()
      if (typeof payload.player_count === 'number') next.player_count = payload.player_count
      if (typeof payload.ending_score === 'number') {
        next.max_score = Math.max(cur.max_score ?? 0, payload.ending_score)
      }
      if (typeof payload.max_points === 'number') next.max_points = payload.max_points
    } else if (type === 'game_reset') {
      if (!cur.ended_at) next.ended_at = FieldValue.serverTimestamp()
      if (typeof payload.player_count === 'number') next.player_count = payload.player_count
      if (typeof payload.max_score === 'number') next.max_score = payload.max_score
      if (typeof payload.max_points === 'number') next.max_points = payload.max_points
    }

    tx.set(ref, next, { merge: true })
  })
}

export const eventsRoute = new Hono().post('/', async (c) => {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'unknown'

  if (!allow(ip)) return c.json({ error: 'rate limited' }, 429)

  const raw = await c.req.json().catch(() => null)
  const parsed = EventBody.safeParse(raw)
  if (!parsed.success) return c.json({ error: 'bad request' }, 400)

  const { session_id, type, payload } = parsed.data

  await db().collection('events').add({
    session_id,
    type,
    payload,
    created_at: FieldValue.serverTimestamp(),
  })

  await updateSessionSummary(session_id, type, payload)

  return c.body(null, 204)
})
