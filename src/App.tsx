import { Backdrop, Box, Button, Checkbox, Collapse, IconButton, Input, Menu, Stack, Typography } from '@mui/material'
import PlayerRow from './PlayerRow'
import { getPlayerColors } from './utils'
import { useState } from 'react'
import AddPlayerDialog from './AddPlayerDialog'
import useLocalStorageState from './hooks/UseLocalStorageState'
import { TransitionGroup } from 'react-transition-group'
import ConfirmationDialog from './ConfirmationDialog'
import HelpDialog from './HelpDialog'
import SettingsIcon from '@mui/icons-material/Settings'
import HelpIcon from '@mui/icons-material/Help'
import { BadgeType } from './Components/Badge';
import { trackGameReset, trackGameWon, trackSettingsChange, trackViewHelp } from './analytics'

type player = {
  name: string
  score: number[]
}

const calculateBadges = (players: player[], playerName: string): BadgeType[] => {
  const badges: BadgeType[] = []

  // Only calculate badges if there are players with scores
  const playersWithScores = players.filter(p => p.score.length > 0)
  if (playersWithScores.length === 0) return badges

  const currentPlayer = players.find(p => p.name === playerName)
  if (!currentPlayer || currentPlayer.score.length === 0) return badges

  const currentTotal = currentPlayer.score.reduce((a, b) => a + b, 0)
  const currentRounds = currentPlayer.score.length

  // Calculate highest score
  const maxScore = Math.max(...playersWithScores.map(p => p.score.reduce((a, b) => a + b, 0)))
  if (currentTotal === maxScore) {
    badges.push('highest')
  }

  // Calculate lowest score (only among players with scores)
  const minScore = Math.min(...playersWithScores.map(p => p.score.reduce((a, b) => a + b, 0)))
  if (currentTotal === minScore && playersWithScores.length > 1) {
    badges.push('lowest')
  }

  // Calculate most rounds
  const maxRounds = Math.max(...playersWithScores.map(p => p.score.length))
  if (currentRounds === maxRounds) {
    badges.push('mostRounds')
  }

  return badges
}

const App = () => {
  const [players, setPlayers] = useLocalStorageState<player[]>('players', [])
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)

  const [allowAnyPoints, setAllowAnyPoints] = useLocalStorageState<boolean>('allowAnyPoints', false)
  const [maxPoints, setMaxPoints] = useLocalStorageState<number>('maxPoints', 10000)
  
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null)

  const firtsPlayer = players.length > 0 ? players[0].name : 'batato'
  const lastPlayer = players.length > 0 ? players[players.length - 1].name : 'batato'

  const firstColor = getPlayerColors(firtsPlayer)
  const lastColor = getPlayerColors(lastPlayer)

  // To make notch-,dynamic island-, punch hole- etc, displays look decent
  document.body.style.background = firstColor

  const addPoints = (name: string, points: number) => {
    const newPlayers = players.map((player) => {
      if (player.name === name) {
        return { ...player, score: [...player.score, points] }
      }
      return player
    })
    setPlayers(newPlayers)

    // Check if player won the game
    const updatedPlayer = newPlayers.find(p => p.name === name)
    if (updatedPlayer) {
      const totalScore = updatedPlayer.score.reduce((a, b) => a + b, 0)
      if (totalScore >= maxPoints) {
        const roundsPlayed = Math.max(...newPlayers.map(p => p.score.length))
        trackGameWon(totalScore, players.length, roundsPlayed)
      }
    }

    window.scrollTo(0, 0)
  }

  const onAddPlayer = (name: string) => {
    setPlayers([...players, { name, score: [] }])
    window.scrollTo(0, 0)
  }

  const onRemovePlayer = (name: string) => {
    const newPlayers = players.filter((player) => player.name !== name)
    setPlayers(newPlayers)
  }

  const onResetGame = () => {
    const roundsPlayed = Math.max(0, ...players.map(p => p.score.length))
    trackGameReset(players.length, roundsPlayed)
    setPlayers(players.map(p => ({ ...p, score: [] })))
    setResetDialogOpen(false)
  }

  const buttonSx = {
    width: '80%',
    borderRadius: 50,
    mb: 1,
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: lastColor,
      sx: {
        p: 0,
      }
    }}>
      <TransitionGroup>
        {players.map((player) => (
          <Collapse key={player.name}>
            <PlayerRow
              {...player}
              addPoints={(points) => addPoints(player.name, points)}
              onRemovePlayer={() => onRemovePlayer(player.name)}
              allowAnyPoints={allowAnyPoints}
              maxPoints={maxPoints}
              badges={calculateBadges(players, player.name)}
              key={player.name}
            />
          </Collapse>
        ))}
      </TransitionGroup>
      <Stack direction="column" sx={{
        alignItems: 'center',
        pt: 4,
      }}>
        <Button
          onClick={() => setPlayerDialogOpen(true)}
          size='large'
          sx={buttonSx}
          variant='outlined'
        >
          Add  player
        </Button>
        <Button
          onClick={() => setResetDialogOpen(true)}
          size='small'
          variant='outlined'
          sx={{
            ...buttonSx,
            width: '60%'
          }}
        >
          Reset game
        </Button>
      </Stack>
      <AddPlayerDialog
        open={playerDialogOpen}
        onClose={() => setPlayerDialogOpen(false)}
        onAdd={onAddPlayer}
      />
      <ConfirmationDialog
        message='Are you sure you want to reset the game?'
        onConfirm={onResetGame}
        onCancel={() => setResetDialogOpen(false)}
        open={resetDialogOpen}
      />
      <HelpDialog
        open={helpDialogOpen}
        onClose={() => setHelpDialogOpen(false)}
      />
      <Stack
        direction="column"
        spacing={1}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
      >
        <IconButton
          onClick={() => {
            setHelpDialogOpen(true)
            trackViewHelp()
          }}
        >
          <HelpIcon color='primary' />
        </IconButton>
        <IconButton
          onClick={(e) =>
            setSettingsAnchorEl(e.currentTarget)}
        >
          <SettingsIcon color='primary' />
        </IconButton>
      </Stack>
      <Backdrop
        open={Boolean(settingsAnchorEl)}
        sx={{
          zIndex: 1000,
        }}
      />

      <Menu
        open={Boolean(settingsAnchorEl)}
        anchorEl={settingsAnchorEl}
        onClose={() => setSettingsAnchorEl(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          sx={{
            p: 2,
            width: 200,
          }}
        >
          <Typography>Allow any points</Typography>
          <Checkbox
            checked={allowAnyPoints}
            onChange={() => {
              const newValue = !allowAnyPoints
              setAllowAnyPoints(newValue)
              trackSettingsChange('allowAnyPoints', newValue)
            }}
            color='default'
          />

        </Stack>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          sx={{
            p: 2,
            width: 200,
          }}
        >
          <Typography>Max Points:</Typography>
          <Input
            type='number'
            value={maxPoints}
            onChange={(e) => {
              const newValue = parseInt(e.target.value)
              setMaxPoints(newValue)
              trackSettingsChange('maxPoints', newValue)
            }}
            sx={{
              width: 100,
            }}
          />

        </Stack>
      </Menu>
    </Box >
  )
}

export default App
