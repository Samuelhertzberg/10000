export type EventType =
  | 'game_start'
  | 'player_added'
  | 'points_added'
  | 'game_ended'
  | 'game_reset'

const SESSION_KEY = 'analytics_session_id'
const SLOTS_KEY = 'analytics_slot_map'
const GAME_ENDED_KEY = 'analytics_game_ended'

let fallbackSessionId: string | null = null
let fallbackSlotMap: Record<string, number> = {}
let fallbackGameEnded = false
let gameStartFired = false

const makeId = (): string => {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const readSessionItem = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const writeSessionItem = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Analytics is best-effort and should never block the game UI.
  }
}

const removeSessionItem = (key: string) => {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Analytics is best-effort and should never block the game UI.
  }
}

const getSessionId = (): string => {
  const storedId = readSessionItem(SESSION_KEY)
  if (storedId) {
    fallbackSessionId = storedId
    return storedId
  }

  if (!fallbackSessionId) fallbackSessionId = makeId()
  writeSessionItem(SESSION_KEY, fallbackSessionId)
  return fallbackSessionId
}

const getSlotMap = (): Record<string, number> => {
  const raw = readSessionItem(SLOTS_KEY)
  if (!raw) return { ...fallbackSlotMap }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...fallbackSlotMap }

    fallbackSlotMap = parsed as Record<string, number>
    return { ...fallbackSlotMap }
  } catch {
    return { ...fallbackSlotMap }
  }
}

const saveSlotMap = (map: Record<string, number>) => {
  fallbackSlotMap = { ...map }
  writeSessionItem(SLOTS_KEY, JSON.stringify(map))
}

const hasGameEnded = (): boolean => {
  const stored = readSessionItem(GAME_ENDED_KEY)
  if (stored === 'true') {
    fallbackGameEnded = true
    return true
  }
  return fallbackGameEnded
}

const markGameEnded = () => {
  fallbackGameEnded = true
  writeSessionItem(GAME_ENDED_KEY, 'true')
}

// Map a player's typed name to a stable per-session slot index so names
// never leave the browser.
export const slotFor = (name: string): number => {
  const map = getSlotMap()
  if (name in map) return map[name]
  const next = Object.keys(map).length
  map[name] = next
  saveSlotMap(map)
  return next
}

const send = (type: EventType, payload: Record<string, unknown>) => {
  try {
    const body = JSON.stringify({
      session_id: getSessionId(),
      type,
      payload,
    })

    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ })
  } catch {
    /* fire-and-forget */
  }
}

export const track = (type: EventType, payload: Record<string, unknown> = {}) => {
  try {
    if (!gameStartFired && type !== 'game_start') {
      gameStartFired = true
      send('game_start', {})
    }
    if (type === 'game_start') gameStartFired = true
    send(type, payload)
  } catch {
    /* fire-and-forget */
  }
}

export const trackGameEnded = (payload: Record<string, unknown> = {}) => {
  try {
    if (hasGameEnded()) return
    markGameEnded()
    track('game_ended', payload)
  } catch {
    /* fire-and-forget */
  }
}

// Reset session boundary (after a game_reset) so the next event starts a new game.
export const resetSession = () => {
  fallbackSessionId = null
  fallbackSlotMap = {}
  fallbackGameEnded = false
  removeSessionItem(SESSION_KEY)
  removeSessionItem(SLOTS_KEY)
  removeSessionItem(GAME_ENDED_KEY)
  gameStartFired = false
}
