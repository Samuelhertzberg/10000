import { Box, Button, Collapse, Stack } from '@mui/material'
import PlayerRow from './PlayerRow'
import { getPlayerColors } from './utils'
import { useState } from 'react'
import AddPlayerDialog from './AddPlayerDialog'
import useLocalStorageState from './hooks/UseLocalStorageState'
import { TransitionGroup } from 'react-transition-group'
import ConfirmationDialog from './ConfirmationDialog'

type player = {
  name: string
  score: number[]
}

const App = () => {
  const [players, setPlayers] = useLocalStorageState<player[]>('players', [])
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

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
  }

  const onRemovePlayer = (name: string) => {
    const newPlayers = players.filter((player) => player.name !== name)
    setPlayers(newPlayers)
  }

  const onResetGame = () => {
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
        onAdd={(name) => setPlayers([...players, { name, score: [] }])}
      />
      <ConfirmationDialog
        message='Are you sure you want to reset the game?'
        onConfirm={onResetGame}
        onCancel={() => setResetDialogOpen(false)}
        open={resetDialogOpen}
        />
    </Box >
  )
}

export default App
