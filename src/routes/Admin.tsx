import { useState } from 'react'
import {
  Box,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

type Stats = {
  total_games: number
  total_events: number
  avg_players_per_game: number
  avg_rounds_per_game: number
  points_distribution: { bucket: string; count: number }[]
  recent_games: {
    session_id: string
    player_count: number
    rounds: number
    max_score: number
    ended_at: string | null
  }[]
}

const Admin = () => {
  const [token, setToken] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onCredential = async (resp: CredentialResponse) => {
    if (!resp.credential) {
      setError('No credential returned from Google.')
      return
    }
    setToken(resp.credential)
    try {
      const r = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${resp.credential}` },
      })
      if (!r.ok) {
        setError(`Stats request failed: ${r.status}`)
        return
      }
      setStats(await r.json())
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Dice 10000 — Admin
      </Typography>

      {!token && (
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

      {stats && (
        <Stack spacing={3} sx={{ mt: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Totals</Typography>
            <Stack direction="row" spacing={4} sx={{ mt: 1 }}>
              <Stat label="Games" value={stats.total_games} />
              <Stat label="Events" value={stats.total_events} />
              <Stat label="Avg players" value={stats.avg_players_per_game.toFixed(1)} />
              <Stat label="Avg rounds" value={stats.avg_rounds_per_game.toFixed(1)} />
            </Stack>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Points per round (distribution)</Typography>
            <Box sx={{ height: 240, mt: 1 }}>
              <ResponsiveContainer>
                <BarChart data={stats.points_distribution}>
                  <XAxis dataKey="bucket" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Recent games</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Session</TableCell>
                  <TableCell align="right">Players</TableCell>
                  <TableCell align="right">Rounds</TableCell>
                  <TableCell align="right">Max score</TableCell>
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
                    <TableCell>{g.ended_at ?? '—'}</TableCell>
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

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h5">{value}</Typography>
  </Box>
)

export default Admin
