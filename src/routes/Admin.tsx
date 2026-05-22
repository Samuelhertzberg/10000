import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type EventType = 'game_start' | 'player_added' | 'points_added' | 'game_ended' | 'game_reset'
type TimelineScale = '15m' | 'hour' | 'day' | 'week'

type RawEventValue = {
  id: string
  type: EventType
  created_at: string
  value: number
  display_value: number
  is_clipped: boolean
}

type TimelinePoint = {
  timestamp: number
  game_start: number
}

type Stats = {
  total_games: number
  total_events: number
  avg_players_per_game: number
  avg_rounds_per_game: number
  event_type_counts: { type: EventType; count: number }[]
  raw_events: RawEventValue[]
  events_by_hour_of_day: ({
    hour: number
    label: string
    total: number
  } & Record<EventType, number>)[]
  player_count_distribution: {
    player_count: number
    label: string
    count: number
  }[]
  recent_games: {
    session_id: string
    player_count: number
    rounds: number
    max_score: number
    started_at: string | null
    ended_at: string | null
  }[]
  event_data_size: number
  event_window_start: string | null
  event_window_end: string | null
}

type AdminProps = {
  googleClientId: string
  isAuthBypassed: boolean
}

const EVENT_LABELS: Record<EventType, string> = {
  game_start: 'Game starts',
  player_added: 'Players added',
  points_added: 'Points added',
  game_ended: 'Games ended',
  game_reset: 'Game resets',
}

const EVENT_COLORS: Record<EventType, string> = {
  game_start: '#1976d2',
  player_added: '#2e7d32',
  points_added: '#ed6c02',
  game_ended: '#d32f2f',
  game_reset: '#9c27b0',
}

const TIMELINE_SCALES: { value: TimelineScale; label: string }[] = [
  { value: '15m', label: '15 min' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
]

const formatDateTime = (value: string | number) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatTimelineTick = (value: number, scale: TimelineScale) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const options = scale === 'day' || scale === 'week'
    ? { month: 'short', day: 'numeric' } as const
    : { hour: '2-digit', minute: '2-digit' } as const
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

const bucketTimestamp = (timestamp: number, scale: TimelineScale) => {
  const date = new Date(timestamp)
  date.setSeconds(0, 0)

  if (scale === '15m') {
    date.setMinutes(Math.floor(date.getMinutes() / 15) * 15)
  } else if (scale === 'hour') {
    date.setMinutes(0)
  } else if (scale === 'day') {
    date.setHours(0, 0, 0, 0)
  } else {
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - date.getDay())
  }

  return date.getTime()
}

const advanceTimestamp = (timestamp: number, scale: TimelineScale) => {
  const date = new Date(timestamp)
  if (scale === '15m') date.setMinutes(date.getMinutes() + 15)
  if (scale === 'hour') date.setHours(date.getHours() + 1)
  if (scale === 'day') date.setDate(date.getDate() + 1)
  if (scale === 'week') date.setDate(date.getDate() + 7)
  return date.getTime()
}

const scaleStepMs = (scale: TimelineScale) => {
  if (scale === '15m') return 15 * 60 * 1000
  if (scale === 'hour') return 60 * 60 * 1000
  if (scale === 'day') return 24 * 60 * 60 * 1000
  return 7 * 24 * 60 * 60 * 1000
}

const emptyTimelinePoint = (timestamp: number): TimelinePoint => ({
  timestamp,
  game_start: 0,
})

const buildTimeline = (events: RawEventValue[], scale: TimelineScale) => {
  const buckets = new Map<number, TimelinePoint>()

  events.forEach((event) => {
    if (event.type !== 'game_start') return
    const timestamp = new Date(event.created_at).getTime()
    if (Number.isNaN(timestamp)) return
    const bucket = bucketTimestamp(timestamp, scale)
    const point = buckets.get(bucket) ?? emptyTimelinePoint(bucket)
    point.game_start += 1
    buckets.set(bucket, point)
  })

  const timestamps = [...buckets.keys()].sort((a, b) => a - b)
  if (timestamps.length === 0) return []

  const first = timestamps[0]
  const last = timestamps[timestamps.length - 1]
  const estimatedBuckets = Math.floor((last - first) / scaleStepMs(scale)) + 1
  if (estimatedBuckets > 1200) {
    return timestamps.map((timestamp) => buckets.get(timestamp)!)
  }

  const timeline: TimelinePoint[] = []
  for (
    let timestamp = first;
    timestamp <= last;
    timestamp = advanceTimestamp(timestamp, scale)
  ) {
    timeline.push(buckets.get(timestamp) ?? emptyTimelinePoint(timestamp))
  }
  return timeline
}

const Admin = ({ googleClientId, isAuthBypassed }: AdminProps) => {
  const [token, setToken] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [timelineScale, setTimelineScale] = useState<TimelineScale>('hour')
  const isGoogleConfigured = googleClientId.trim().length > 0

  const fetchStats = useCallback(async (credential?: string) => {
    const headers: HeadersInit = credential
      ? { Authorization: `Bearer ${credential}` }
      : {}

    try {
      setLoading(true)
      setError(null)
      const r = await fetch('/api/admin/stats', { headers })
      if (!r.ok) {
        setError(
          r.status === 500
            ? 'Admin API is not configured. Set GOOGLE_CLIENT_ID and ADMIN_EMAIL, or use the local Firestore emulator bypass.'
            : `Stats request failed: ${r.status}`,
        )
        return
      }
      setStats(await r.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthBypassed) {
      void fetchStats()
    }
  }, [fetchStats, isAuthBypassed])

  const onCredential = async (resp: CredentialResponse) => {
    if (!resp.credential) {
      setError('No credential returned from Google.')
      return
    }
    setToken(resp.credential)
    await fetchStats(resp.credential)
  }

  const dataWindow = useMemo(() => {
    if (!stats?.event_window_start || !stats.event_window_end) return 'No events yet'
    return `${formatDateTime(stats.event_window_start)} to ${formatDateTime(stats.event_window_end)}`
  }, [stats])

  const timelineData = useMemo(
    () => buildTimeline(stats?.raw_events ?? [], timelineScale),
    [stats, timelineScale],
  )

  const gameStartCount = stats?.event_type_counts
    .find((event) => event.type === 'game_start')
    ?.count ?? 0

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1360, mx: 'auto' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" gutterBottom>
            Dice 10000 — Admin
          </Typography>
          {stats && (
            <Typography variant="body2" color="text.secondary">
              Event window: {dataWindow}
            </Typography>
          )}
        </Box>
        {stats && (
          <Button variant="outlined" onClick={() => void fetchStats(token ?? undefined)}>
            Refresh
          </Button>
        )}
      </Stack>

      {isAuthBypassed && (
        <Alert severity="info" sx={{ my: 2 }}>
          Using local admin access against the Firestore emulator.
        </Alert>
      )}

      {!isAuthBypassed && !isGoogleConfigured && (
        <Alert severity="warning" sx={{ my: 2 }}>
          Google sign-in is not configured for this build. Set
          VITE_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID, and ADMIN_EMAIL before
          starting the app to use admin stats.
        </Alert>
      )}

      {!token && !isAuthBypassed && isGoogleConfigured && (
        <Stack spacing={2}>
          <Typography>Sign in with Google to view stats.</Typography>
          <GoogleLogin
            onSuccess={onCredential}
            onError={() => setError('Sign-in failed.')}
            useOneTap={false}
          />
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
      {loading && <Alert severity="info" sx={{ my: 2 }}>Loading stats...</Alert>}

      {stats && (
        <Stack spacing={2.5} sx={{ mt: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            <Stat label="Games" value={stats.total_games} />
            <Stat label="Events" value={stats.total_events} />
            <Stat label="Avg players" value={stats.avg_players_per_game.toFixed(1)} />
            <Stat label="Avg rounds" value={stats.avg_rounds_per_game.toFixed(1)} />
          </Box>

          <ChartPanel
            title="Timeline"
            subtitle={`${gameStartCount.toLocaleString()} game starts grouped by ${TIMELINE_SCALES.find((scale) => scale.value === timelineScale)?.label.toLowerCase()}`}
            height={360}
            actions={(
              <ToggleGroup
                value={timelineScale}
                onChange={(value) => setTimelineScale(value as TimelineScale)}
                options={TIMELINE_SCALES}
              />
            )}
          >
            <ResponsiveContainer>
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value) => formatTimelineTick(Number(value), timelineScale)}
                  minTickGap={36}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(value) => formatDateTime(Number(value))}
                  formatter={(value) => [value, 'Game starts']}
                />
                <Area
                  type="monotone"
                  dataKey="game_start"
                  stroke={EVENT_COLORS.game_start}
                  fill={EVENT_COLORS.game_start}
                  fillOpacity={0.28}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 2,
            }}
          >
            <ChartPanel
              title="Event Mix"
              subtitle="Total event counts by event type"
              height={280}
            >
              <ResponsiveContainer>
                <BarChart data={stats.event_type_counts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="type"
                    tickFormatter={(value) => EVENT_LABELS[value as EventType] ?? value}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [value, 'Events']}
                    labelFormatter={(value) => EVENT_LABELS[value as EventType] ?? value}
                  />
                  <Bar dataKey="count" fill="#1976d2">
                    {stats.event_type_counts.map((event) => (
                      <Cell key={event.type} fill={EVENT_COLORS[event.type]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Hour Of Day"
              subtitle="Event distribution across the 24 UTC hours"
              height={280}
            >
              <ResponsiveContainer>
                <BarChart data={stats.events_by_hour_of_day}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" minTickGap={8} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, 'Events']} />
                  <Bar dataKey="total" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              title="Players Per Game"
              subtitle="Distribution of player counts across games"
              height={280}
            >
              <ResponsiveContainer>
                <BarChart data={stats.player_count_distribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [value, 'Games']} />
                  <Bar dataKey="count" fill={EVENT_COLORS.player_added} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </Box>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Recent Games</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Session</TableCell>
                  <TableCell align="right">Players</TableCell>
                  <TableCell align="right">Rounds</TableCell>
                  <TableCell align="right">Max score</TableCell>
                  <TableCell>Started at</TableCell>
                  <TableCell>Ended at</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.recent_games.map((g) => (
                  <TableRow key={g.session_id}>
                    <TableCell><code>{g.session_id.slice(0, 8)}</code></TableCell>
                    <TableCell align="right">{g.player_count}</TableCell>
                    <TableCell align="right">{g.rounds}</TableCell>
                    <TableCell align="right">{g.max_score}</TableCell>
                    <TableCell>{g.started_at ? formatDateTime(g.started_at) : '-'}</TableCell>
                    <TableCell>{g.ended_at ? formatDateTime(g.ended_at) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      )}
    </Box>
  )
}

const ToggleGroup = <T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) => (
  <ToggleButtonGroup
    exclusive
    size="small"
    value={value}
    onChange={(_event, nextValue: T | null) => {
      if (nextValue) onChange(nextValue)
    }}
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 0.75,
      '& .MuiToggleButtonGroup-grouped': {
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        m: 0,
      },
    }}
  >
    {options.map((option) => (
      <ToggleButton key={option.value} value={option.value}>
        {option.label}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
)

const ChartPanel = ({
  title,
  subtitle,
  height,
  actions,
  children,
}: {
  title: string
  subtitle: string
  height: number
  actions?: ReactNode
  children: ReactNode
}) => (
  <Paper sx={{ p: 2, minWidth: 0 }}>
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      sx={{ alignItems: { xs: 'stretch', md: 'flex-start' }, mb: 2 }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Box>
      {actions}
    </Stack>
    <Box sx={{ height, minWidth: 0 }}>{children}</Box>
  </Paper>
)

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <Paper sx={{ p: 2 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h5">{value}</Typography>
  </Paper>
)

export default Admin
