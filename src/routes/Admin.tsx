import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Slider,
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
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

type EventType = 'game_start' | 'player_added' | 'points_added' | 'game_ended' | 'game_reset'
type TimelineScale = '15m' | 'hour' | 'day' | 'week'
type SummaryMode = 'average' | 'median'

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

type BankedPointsHeatmapCell = {
  current_score: number
  accepted_points: number
  round_count: number
}

type BankedPointsHeatmapData = {
  bin_size: number
  cells: BankedPointsHeatmapCell[]
}

type HeatmapRange = [number, number]

type Stats = {
  total_games: number
  total_events: number
  avg_players_per_game: number
  avg_rounds_per_game: number
  avg_score_per_round: number
  avg_game_time_ms: number | null
  median_players_per_game: number
  median_rounds_per_game: number
  median_score_per_round: number
  median_game_time_ms: number | null
  games_started_last_7_days: number
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
  banked_points_by_current_score: BankedPointsHeatmapData
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

type SessionPlayer = {
  slot: number
  key: string
  label: string
  total_score: number
  rounds: number
  top_round_score: number | null
  lowest_round_score: number | null
}

type SessionRound = {
  slot: number
  label: string
  points: number
  total_score: number
  created_at: string | null
}

type SessionTimelinePoint = {
  timestamp: number
  created_at: string | null
  round: number
  event_slot: number | null
  event_player: string | null
  event_points: number | null
} & Record<string, string | number | null>

type SessionDetail = {
  session_id: string
  summary: {
    player_count: number
    rounds: number
    max_score: number
    max_points: number
    top_score: number
    lowest_score: number
    started_at: string | null
    ended_at: string | null
    created_at: string | null
    last_event_at: string | null
    duration_ms: number | null
    avg_time_between_rounds_ms: number | null
    shortest_time_between_rounds_ms: number | null
    longest_time_between_rounds_ms: number | null
  }
  players: SessionPlayer[]
  top_rounds: SessionRound[]
  lowest_rounds: SessionRound[]
  timeline: SessionTimelinePoint[]
  events: {
    id: string
    type: string
    created_at: string | null
    payload: Record<string, unknown>
  }[]
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

const SUMMARY_MODES: { value: SummaryMode; label: string }[] = [
  { value: 'average', label: 'Average' },
  { value: 'median', label: 'Median' },
]

const PLAYER_LINE_COLORS = [
  '#1976d2',
  '#2e7d32',
  '#ed6c02',
  '#9c27b0',
  '#d32f2f',
  '#00838f',
  '#6d4c41',
  '#455a64',
]

const HEATMAP_COLOR_STOPS = [
  [255, 247, 236],
  [255, 237, 160],
  [254, 178, 76],
  [215, 48, 31],
] as const

const heatmapColor = (count: number, maxCount: number) => {
  const ratio = maxCount <= 1 ? 0 : Math.max(0, Math.min(1, (count - 1) / (maxCount - 1)))
  const scaled = ratio * (HEATMAP_COLOR_STOPS.length - 1)
  const lowerIndex = Math.floor(scaled)
  const upperIndex = Math.min(HEATMAP_COLOR_STOPS.length - 1, lowerIndex + 1)
  const position = scaled - lowerIndex
  const lower = HEATMAP_COLOR_STOPS[lowerIndex]
  const upper = HEATMAP_COLOR_STOPS[upperIndex]
  const color = lower.map((value, index) =>
    Math.round(value + (upper[index] - value) * position),
  )
  return `rgb(${color.join(', ')})`
}

const formatPointBin = (value: number, binSize: number) =>
  `${value.toLocaleString()}–${(value + binSize - 1).toLocaleString()}`

const clampHeatmapRange = (
  selectedRange: HeatmapRange | null,
  availableRange: HeatmapRange,
): HeatmapRange => {
  if (!selectedRange) return availableRange
  const minimum = Math.max(availableRange[0], Math.min(selectedRange[0], availableRange[1]))
  const maximum = Math.max(minimum, Math.min(selectedRange[1], availableRange[1]))
  return [minimum, maximum]
}

type HeatmapShapeProps = {
  fill?: string
  payload?: BankedPointsHeatmapCell & { bin_size: number; fill: string }
  xAxis?: { scale: (value: number) => number }
  yAxis?: { scale: (value: number) => number }
}

const HeatmapCellShape = (rawProps: unknown) => {
  const { fill, payload, xAxis, yAxis } = rawProps as HeatmapShapeProps
  if (!payload || !xAxis || !yAxis) return <g />

  const x1 = xAxis.scale(payload.current_score)
  const x2 = xAxis.scale(payload.current_score + payload.bin_size)
  const y1 = yAxis.scale(payload.accepted_points)
  const y2 = yAxis.scale(payload.accepted_points + payload.bin_size)
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.max(1, Math.abs(x2 - x1))
  const height = Math.max(1, Math.abs(y2 - y1))

  return (
    <rect
      fill={fill ?? payload.fill}
      height={height}
      stroke="rgba(255, 255, 255, 0.72)"
      strokeWidth={0.5}
      width={width}
      x={x}
      y={y}
    >
      <title>
        {`Points already earned ${formatPointBin(payload.current_score, payload.bin_size)}; points accepted ${formatPointBin(payload.accepted_points, payload.bin_size)}; ${payload.round_count.toLocaleString()} rounds`}
      </title>
    </rect>
  )
}

const HeatmapTooltip = ({
  active,
  binSize,
  payload,
}: {
  active?: boolean
  binSize: number
  payload?: { payload?: BankedPointsHeatmapCell }[]
}) => {
  const cell = payload?.[0]?.payload
  if (!active || !cell) return null

  return (
    <Paper sx={{ p: 1.25 }} elevation={4}>
      <Typography variant="body2">
        Points already earned: {formatPointBin(cell.current_score, binSize)}
      </Typography>
      <Typography variant="body2">
        Points accepted: {formatPointBin(cell.accepted_points, binSize)}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        Rounds: {cell.round_count.toLocaleString()}
      </Typography>
    </Paper>
  )
}

const HeatmapLegend = ({ maxCount }: { maxCount: number }) => (
  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'center' }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}
    >
      Fewer rounds
    </Typography>
    <Box sx={{ width: 220, maxWidth: { xs: '80%', sm: '45vw' } }}>
      <Box
        sx={{
          background: 'linear-gradient(90deg, #fff7ec 0%, #ffeda0 33%, #feb24c 67%, #d7301f 100%)',
          border: 1,
          borderColor: 'divider',
          height: 12,
        }}
      />
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="caption">1</Typography>
        <Typography variant="caption">{maxCount.toLocaleString()}</Typography>
      </Stack>
    </Box>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}
    >
      More rounds
    </Typography>
  </Stack>
)

const HeatmapRangeFilter = ({
  availableRange,
  binSize,
  label,
  onChange,
  value,
}: {
  availableRange: HeatmapRange
  binSize: number
  label: string
  onChange: (range: HeatmapRange) => void
  value: HeatmapRange
}) => {
  const hasRange = availableRange[0] < availableRange[1]

  return (
    <Box sx={{ minWidth: 180, width: { xs: '100%', sm: 220 } }}>
      <Typography variant="caption" color="text.secondary">
        {label}: {value[0].toLocaleString()}–{(value[1] + binSize - 1).toLocaleString()}
      </Typography>
      <Slider
        aria-label={label}
        disabled={!hasRange}
        getAriaLabel={(index) => `${index === 0 ? 'Minimum' : 'Maximum'} ${label.toLowerCase()}`}
        max={hasRange ? availableRange[1] : availableRange[0] + binSize}
        min={availableRange[0]}
        onChange={(_event, nextValue) => onChange(nextValue as HeatmapRange)}
        step={binSize}
        value={value}
        valueLabelDisplay="auto"
        valueLabelFormat={(pointValue) => pointValue.toLocaleString()}
      />
    </Box>
  )
}

const authHeaders = (credential?: string): HeadersInit =>
  credential ? { Authorization: `Bearer ${credential}` } : {}

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

const formatOptionalDateTime = (value: string | null) => value ? formatDateTime(value) : '-'

const formatDuration = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return '-'
  const totalSeconds = Math.max(0, Math.round(value / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
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
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('average')
  const [timelineScale, setTimelineScale] = useState<TimelineScale>('hour')
  const [currentScoreRange, setCurrentScoreRange] = useState<HeatmapRange | null>(null)
  const [acceptedPointsRange, setAcceptedPointsRange] = useState<HeatmapRange | null>(null)
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const isGoogleConfigured = googleClientId.trim().length > 0

  const fetchStats = useCallback(async (credential?: string) => {
    try {
      setLoading(true)
      setError(null)
      const r = await fetch('/api/admin/stats', { headers: authHeaders(credential) })
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

  const fetchSession = useCallback(async (sessionId: string, credential?: string) => {
    try {
      setSessionLoading(true)
      setSessionError(null)
      setSessionDetail(null)
      const r = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, {
        headers: authHeaders(credential),
      })
      if (!r.ok) {
        setSessionError(`Session request failed: ${r.status}`)
        return
      }
      setSessionDetail(await r.json())
    } catch (e) {
      setSessionError(String(e))
    } finally {
      setSessionLoading(false)
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

  const scoreDistribution = useMemo(() => {
    const counts = new Map<number, number>()
    stats?.raw_events.forEach((event) => {
      if (event.type !== 'points_added' || !Number.isFinite(event.value) || event.value <= 0) return
      counts.set(event.value, (counts.get(event.value) ?? 0) + 1)
    })
    return [...counts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([score, count]) => ({ score, count }))
  }, [stats])

  const bankedPointsHeatmap = useMemo(() => {
    const source = stats?.banked_points_by_current_score
    const sourceCells = source?.cells ?? []
    const binSize = source?.bin_size ?? 50
    const availableCurrentScoreRange: HeatmapRange = sourceCells.length > 0
      ? [
          sourceCells.reduce((min, cell) => Math.min(min, cell.current_score), Infinity),
          sourceCells.reduce((max, cell) => Math.max(max, cell.current_score), -Infinity),
        ]
      : [0, 0]
    const availableAcceptedPointsRange: HeatmapRange = sourceCells.length > 0
      ? [
          sourceCells.reduce((min, cell) => Math.min(min, cell.accepted_points), Infinity),
          sourceCells.reduce((max, cell) => Math.max(max, cell.accepted_points), -Infinity),
        ]
      : [0, 0]
    const selectedCurrentScoreRange = clampHeatmapRange(
      currentScoreRange,
      availableCurrentScoreRange,
    )
    const selectedAcceptedPointsRange = clampHeatmapRange(
      acceptedPointsRange,
      availableAcceptedPointsRange,
    )
    const cells = sourceCells.filter((cell) =>
      cell.current_score >= selectedCurrentScoreRange[0] &&
      cell.current_score <= selectedCurrentScoreRange[1] &&
      cell.accepted_points >= selectedAcceptedPointsRange[0] &&
      cell.accepted_points <= selectedAcceptedPointsRange[1],
    )
    const maxCount = cells.reduce((max, cell) => Math.max(max, cell.round_count), 0)
    const xBinCount = Math.floor(
      (selectedCurrentScoreRange[1] - selectedCurrentScoreRange[0]) / binSize,
    ) + 1
    const yBinCount = Math.floor(
      (selectedAcceptedPointsRange[1] - selectedAcceptedPointsRange[0]) / binSize,
    ) + 1

    return {
      availableAcceptedPointsRange,
      availableCurrentScoreRange,
      binSize,
      cells: cells.map((cell) => ({
        ...cell,
        bin_size: binSize,
        fill: heatmapColor(cell.round_count, maxCount),
      })),
      chartHeight: Math.max(360, yBinCount * 7 + 105),
      chartMinWidth: Math.max(720, xBinCount * 7 + 120),
      maxCount,
      selectedAcceptedPointsRange,
      selectedCurrentScoreRange,
      totalRounds: cells.reduce((sum, cell) => sum + cell.round_count, 0),
      totalUnfilteredRounds: sourceCells.reduce((sum, cell) => sum + cell.round_count, 0),
      xDomain: [
        selectedCurrentScoreRange[0],
        selectedCurrentScoreRange[1] + binSize,
      ] as HeatmapRange,
      yDomain: [
        selectedAcceptedPointsRange[0],
        selectedAcceptedPointsRange[1] + binSize,
      ] as HeatmapRange,
    }
  }, [acceptedPointsRange, currentScoreRange, stats])

  const heatmapHasFilters =
    bankedPointsHeatmap.selectedCurrentScoreRange[0] !==
      bankedPointsHeatmap.availableCurrentScoreRange[0] ||
    bankedPointsHeatmap.selectedCurrentScoreRange[1] !==
      bankedPointsHeatmap.availableCurrentScoreRange[1] ||
    bankedPointsHeatmap.selectedAcceptedPointsRange[0] !==
      bankedPointsHeatmap.availableAcceptedPointsRange[0] ||
    bankedPointsHeatmap.selectedAcceptedPointsRange[1] !==
      bankedPointsHeatmap.availableAcceptedPointsRange[1]

  const setHeatmapRange = (
    range: HeatmapRange,
    availableRange: HeatmapRange,
    setRange: (range: HeatmapRange | null) => void,
  ) => {
    setRange(
      range[0] === availableRange[0] && range[1] === availableRange[1]
        ? null
        : range,
    )
  }

  const gameStartCount = stats?.event_type_counts
    .find((event) => event.type === 'game_start')
    ?.count ?? 0

  const openSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setSessionDialogOpen(true)
    void fetchSession(sessionId, token ?? undefined)
  }

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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            <Typography variant="h6" sx={{ flex: 1 }}>At a glance</Typography>
            <ToggleGroup
              value={summaryMode}
              onChange={(value) => setSummaryMode(value as SummaryMode)}
              options={SUMMARY_MODES}
            />
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                xl: 'repeat(6, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            <Stat label="Games" value={stats.total_games} />
            <Stat label="Games started in last 7 days" value={stats.games_started_last_7_days} />
            <Stat label="Events" value={stats.total_events} />
            <Stat
              label={summaryMode === 'average' ? 'Avg players' : 'Median players'}
              value={(summaryMode === 'average'
                ? stats.avg_players_per_game
                : stats.median_players_per_game).toFixed(1)}
            />
            <Stat
              label={summaryMode === 'average' ? 'Avg rounds' : 'Median rounds'}
              value={(summaryMode === 'average'
                ? stats.avg_rounds_per_game
                : stats.median_rounds_per_game).toFixed(1)}
            />
            <Stat
              label={summaryMode === 'average' ? 'Avg game time' : 'Median game time'}
              value={formatDuration(summaryMode === 'average'
                ? stats.avg_game_time_ms
                : stats.median_game_time_ms)}
            />
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

            <ChartPanel
              title="Scores Per Round"
              subtitle="Positive round scores by frequency (logarithmic score scale)"
              height={280}
            >
              {scoreDistribution.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="score"
                      domain={[
                        (dataMin: number) => Math.max(1, dataMin * 0.8),
                        (dataMax: number) => dataMax * 1.2,
                      ]}
                      scale="log"
                      tickFormatter={(value) => Number(value).toLocaleString()}
                      type="number"
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [value, 'Rounds']}
                      labelFormatter={(value) => `${Number(value).toLocaleString()} points`}
                    />
                    <Bar
                      dataKey="count"
                      fill={EVENT_COLORS.points_added}
                      maxBarSize={48}
                      minPointSize={3}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyPanel>No positive score events yet.</EmptyPanel>
              )}
            </ChartPanel>
          </Box>

          <ChartPanel
            title="Points Accepted by Points Already Earned"
            subtitle={`${bankedPointsHeatmap.totalRounds.toLocaleString()} of ${bankedPointsHeatmap.totalUnfilteredRounds.toLocaleString()} banked rounds in ${bankedPointsHeatmap.binSize.toLocaleString()}-point bins. Darker cells occurred more often.`}
            height={bankedPointsHeatmap.chartHeight + 54}
            actions={(
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
              >
                <HeatmapRangeFilter
                  availableRange={bankedPointsHeatmap.availableCurrentScoreRange}
                  binSize={bankedPointsHeatmap.binSize}
                  label="Points already earned"
                  onChange={(range) => setHeatmapRange(
                    range,
                    bankedPointsHeatmap.availableCurrentScoreRange,
                    setCurrentScoreRange,
                  )}
                  value={bankedPointsHeatmap.selectedCurrentScoreRange}
                />
                <HeatmapRangeFilter
                  availableRange={bankedPointsHeatmap.availableAcceptedPointsRange}
                  binSize={bankedPointsHeatmap.binSize}
                  label="Points accepted"
                  onChange={(range) => setHeatmapRange(
                    range,
                    bankedPointsHeatmap.availableAcceptedPointsRange,
                    setAcceptedPointsRange,
                  )}
                  value={bankedPointsHeatmap.selectedAcceptedPointsRange}
                />
                <Button
                  disabled={!heatmapHasFilters}
                  onClick={() => {
                    setCurrentScoreRange(null)
                    setAcceptedPointsRange(null)
                  }}
                  size="small"
                >
                  Reset
                </Button>
              </Stack>
            )}
          >
            {bankedPointsHeatmap.totalUnfilteredRounds === 0 ? (
              <EmptyPanel>No positive banked rounds with current score data yet.</EmptyPanel>
            ) : bankedPointsHeatmap.cells.length > 0 ? (
              <Stack spacing={1.25} sx={{ height: '100%' }}>
                <Box sx={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
                  <Box sx={{ height: '100%', minWidth: bankedPointsHeatmap.chartMinWidth }}>
                    <ResponsiveContainer>
                      <ScatterChart margin={{ top: 16, right: 24, bottom: 40, left: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          allowDataOverflow
                          dataKey="current_score"
                          domain={bankedPointsHeatmap.xDomain}
                          name="Points already earned"
                          tickFormatter={(value) => Number(value).toLocaleString()}
                          type="number"
                          label={{
                            value: 'Points already earned',
                            position: 'insideBottom',
                            offset: -24,
                          }}
                        />
                        <YAxis
                          allowDataOverflow
                          dataKey="accepted_points"
                          domain={bankedPointsHeatmap.yDomain}
                          name="Points accepted"
                          tickFormatter={(value) => Number(value).toLocaleString()}
                          type="number"
                          label={{
                            value: 'Points accepted',
                            angle: -90,
                            position: 'insideLeft',
                            offset: -20,
                          }}
                        />
                        <ZAxis dataKey="round_count" name="Rounds" range={[64, 64]} />
                        <Tooltip
                          content={<HeatmapTooltip binSize={bankedPointsHeatmap.binSize} />}
                          cursor={false}
                        />
                        <Scatter
                          data={bankedPointsHeatmap.cells}
                          isAnimationActive={false}
                          shape={HeatmapCellShape}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
                <HeatmapLegend maxCount={bankedPointsHeatmap.maxCount} />
              </Stack>
            ) : (
              <EmptyPanel>No banked rounds match these filters.</EmptyPanel>
            )}
          </ChartPanel>

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
                  <TableRow
                    hover
                    key={g.session_id}
                    onClick={() => openSession(g.session_id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Button
                        size="small"
                        variant="text"
                        onClick={(event) => {
                          event.stopPropagation()
                          openSession(g.session_id)
                        }}
                        sx={{ minWidth: 0, p: 0, textTransform: 'none' }}
                      >
                        <code>{g.session_id.slice(0, 8)}</code>
                      </Button>
                    </TableCell>
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
      <SessionViewerDialog
        detail={sessionDetail}
        error={sessionError}
        loading={sessionLoading}
        onClose={() => setSessionDialogOpen(false)}
        open={sessionDialogOpen}
        sessionId={selectedSessionId}
      />
    </Box>
  )
}

const SessionViewerDialog = ({
  detail,
  error,
  loading,
  onClose,
  open,
  sessionId,
}: {
  detail: SessionDetail | null
  error: string | null
  loading: boolean
  onClose: () => void
  open: boolean
  sessionId: string | null
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
    <DialogTitle>
      Session {detail || sessionId ? <code>{(detail?.session_id ?? sessionId)?.slice(0, 8)}</code> : ''}
    </DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2.5}>
        {loading && <Alert severity="info">Loading session...</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {detail && (
          <>
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
              <Stat label="Players" value={detail.summary.player_count} />
              <Stat label="Rounds" value={detail.summary.rounds} />
              <Stat label="Top score" value={detail.summary.top_score} />
              <Stat label="Lowest score" value={detail.summary.lowest_score} />
              <Stat label="Max round" value={detail.summary.max_score} />
              <Stat label="Target" value={detail.summary.max_points} />
              <Stat label="Duration" value={formatDuration(detail.summary.duration_ms)} />
              <Stat label="Avg round gap" value={formatDuration(detail.summary.avg_time_between_rounds_ms)} />
            </Box>

            <ChartPanel
              title="Score Timeline"
              subtitle="Cumulative score by anonymous player slot"
              height={360}
            >
              {detail.timeline.length > 1 && detail.players.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={detail.timeline} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => formatDateTime(Number(value))}
                      minTickGap={36}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(value) => formatDateTime(Number(value))}
                      formatter={(value, name) => [value, name]}
                    />
                    {detail.players.map((player, index) => (
                      <Line
                        key={player.key}
                        type="monotone"
                        dataKey={player.key}
                        name={player.label}
                        stroke={PLAYER_LINE_COLORS[index % PLAYER_LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={detail.timeline.length <= 30}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyPanel>No score events for this session.</EmptyPanel>
              )}
            </ChartPanel>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: 2,
              }}
            >
              <Paper sx={{ p: 2, minWidth: 0 }}>
                <Typography variant="h6">Players</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Player</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="right">Rounds</TableCell>
                      <TableCell align="right">Best round</TableCell>
                      <TableCell align="right">Lowest round</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.players.map((player) => (
                      <TableRow key={player.key}>
                        <TableCell>{player.label}</TableCell>
                        <TableCell align="right">{player.total_score}</TableCell>
                        <TableCell align="right">{player.rounds}</TableCell>
                        <TableCell align="right">{player.top_round_score ?? '-'}</TableCell>
                        <TableCell align="right">{player.lowest_round_score ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>

              <Paper sx={{ p: 2, minWidth: 0 }}>
                <Typography variant="h6">Round Timing</Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Started</TableCell>
                      <TableCell align="right">{formatOptionalDateTime(detail.summary.started_at)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Ended</TableCell>
                      <TableCell align="right">{formatOptionalDateTime(detail.summary.ended_at)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Shortest gap</TableCell>
                      <TableCell align="right">{formatDuration(detail.summary.shortest_time_between_rounds_ms)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Longest gap</TableCell>
                      <TableCell align="right">{formatDuration(detail.summary.longest_time_between_rounds_ms)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: 2,
              }}
            >
              <RoundList title="Top Rounds" rounds={detail.top_rounds} />
              <RoundList title="Lowest Rounds" rounds={detail.lowest_rounds} />
            </Box>

            <Paper sx={{ p: 2, minWidth: 0 }}>
              <Typography variant="h6">Events</Typography>
              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Payload</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detail.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{formatOptionalDateTime(event.created_at)}</TableCell>
                        <TableCell>{EVENT_LABELS[event.type as EventType] ?? event.type}</TableCell>
                        <TableCell>
                          <Typography
                            component="code"
                            sx={{
                              display: 'block',
                              fontFamily: 'monospace',
                              fontSize: 12,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {JSON.stringify(event.payload)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          </>
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
)

const RoundList = ({ title, rounds }: { title: string; rounds: SessionRound[] }) => (
  <Paper sx={{ p: 2, minWidth: 0 }}>
    <Typography variant="h6">{title}</Typography>
    {rounds.length === 0 ? (
      <EmptyPanel>No rounds.</EmptyPanel>
    ) : (
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Player</TableCell>
            <TableCell align="right">Points</TableCell>
            <TableCell align="right">Total after</TableCell>
            <TableCell>Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rounds.map((round, index) => (
            <TableRow key={`${round.created_at}-${round.slot}-${index}`}>
              <TableCell>{round.label}</TableCell>
              <TableCell align="right">{round.points}</TableCell>
              <TableCell align="right">{round.total_score}</TableCell>
              <TableCell>{formatOptionalDateTime(round.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </Paper>
)

const EmptyPanel = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      alignItems: 'center',
      color: 'text.secondary',
      display: 'flex',
      height: '100%',
      justifyContent: 'center',
      minHeight: 120,
      textAlign: 'center',
    }}
  >
    <Typography variant="body2">{children}</Typography>
  </Box>
)

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
