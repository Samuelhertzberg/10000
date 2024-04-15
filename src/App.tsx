import { Box, Button, Stack } from '@mui/material'
import PlayerRow from './PlayerRow'
import { getPlayerColors } from './utils'
import { useState } from 'react'
import AddPlayerDialog from './AddPlayerDialog'
import useLocalStorageState from './hooks/UseLocalStorageState'

type player = {
  name: string
  score: number[]
}

const App = () => {
  const [players, setPlayers] = useLocalStorageState<player[]>('players', [])
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false)

  const lastPlayer = players.length > 0 ? players[players.length - 1].name : 'batato'

  const { primary } = getPlayerColors(lastPlayer)

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

  const buttonSx = {
    width: '80%',
    borderRadius: 50,
    color: 'white',
    border: '1px solid white',
    mb: 1,
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: primary,
      sx: {
        p: 0,
      }
    }}>
      {players.map((player) => (
        <PlayerRow
          {...player}
          addPoints={(points) => addPoints(player.name, points)}
          onRemovePlayer={() => onRemovePlayer(player.name)}
          key={player.name}
        />
      ))}
      <Stack direction="column" sx={{
        alignItems: 'center',
        pt: 4,
      }}>
        <Button
          onClick={() => setPlayerDialogOpen(true)}
          size='large'
          variant='outlined'
          sx={buttonSx}
        >
          Add  player
        </Button>
        <Button
          onClick={() => setPlayers(players.map(p => ({ ...p, score: [] })))}
          size='small'
          variant='outlined'
          sx={{
            ...buttonSx,
            width: '60%',
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
    </Box >
  )
}

export default App
