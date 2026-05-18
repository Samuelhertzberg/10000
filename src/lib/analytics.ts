export type EventType =
  | 'game_start'
  | 'player_added'
  | 'points_added'
  | 'game_reset'

const SESSION_KEY = 'analytics_session_id'
const SLOTS_KEY = 'analytics_slot_map'

const getSessionId = (): string => {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

const getSlotMap = (): Record<string, number> => {
  const raw = sessionStorage.getItem(SLOTS_KEY)
  return raw ? JSON.parse(raw) : {}
}

const saveSlotMap = (map: Record<string, number>) => {
  sessionStorage.setItem(SLOTS_KEY, JSON.stringify(map))
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

let gameStartFired = false

const send = (type: EventType, payload: Record<string, unknown>) => {
  const body = JSON.stringify({
    session_id: getSessionId(),
    type,
    payload,
  })
  try {
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
  if (!gameStartFired && type !== 'game_start') {
    gameStartFired = true
    send('game_start', {})
  }
  if (type === 'game_start') gameStartFired = true
  send(type, payload)
}

// Reset session boundary (after a game_reset) so the next event starts a new game.
export const resetSession = () => {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SLOTS_KEY)
  gameStartFired = false
}
