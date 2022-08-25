import './App.css';
import PlayerList from './components/PlayerList';
import AddPlayerButton from './components/MainPageButton/MainPageButton';
import React, {useState, useEffect} from 'react';
import Color from 'color';
import PlayerPrompt from './components/Prompt/PlayerPrompt';
import ResetPrompt from './components/Prompt/ResetPrompt';
import { useKeepAwake } from 'expo-keep-awake';

function App() {
  useKeepAwake()

  const getStoredPlayers = () => {
    try {
      return JSON.parse(window.localStorage.getItem('players')) || []
    }
    catch(e) {
      return []
    }
  }

  
  const [playerModal, setPlayerModal] = React.useState(false);
  const [resetModal, setResetModal] = React.useState(false);
  const [players, setPlayers] = useState(getStoredPlayers());

  useEffect(() => {
    localStorage.setItem('players', JSON.stringify(players));
  }, [players])

  const addPlayer = (name) => {
    if (players.find(player => player.name === name)) {
      alert("Player already exists");
    } else {
      setPlayers([...players, {name, points: []}]);
      setPlayerModal(false)
    }
  }

  const removePlayer = (name) => {
    setPlayers(players.filter(player => player.name !== name));
  }

  const addPoints = (name, points) => {
    if(points !== 0 && points % 50 === 0){
      const newPlayers = players.map(player => {
        if (player.name === name) {
          player.points.push(Number.parseInt(points));
        }
        return player;
      })
      setPlayers(newPlayers);
    } else {
      alert("Not a valid value");
    }
  }

  const clearAllPoints = () => {
    const newPlayers = players.map(player => {
      player.points = [];
      return player;
    })
    setPlayers(newPlayers);
    setResetModal(false)
  }


  const getColors = (name) => {
      const r = new Math.seedrandom(name)
      const rand = Math.floor(r() * 1000000000)
      const hex = '#' + rand.toString(16).substring(0, 6)
      const hexLight = Color(hex).lighten(0.1).hex()
      return {primary: hex, secondary: hexLight}
  }

  return (
    <div className="App" style={{backgroundColor: getColors(players.length > 0 ? players[players.length - 1].name : "batato").primary}}>
      <PlayerList players={players} addPoints={addPoints} getColors={getColors} removePlayer={removePlayer}/>
      <br hidden={players.length > 0}/>
      <br hidden={players.length > 0}/>
      <AddPlayerButton onClick={() => setPlayerModal(true)} title="Add Player" size="big"/>
      <AddPlayerButton onClick={() => setResetModal(true)} title="Reset Game" size="small"/>
      <PlayerPrompt open={playerModal} onSubmit={addPlayer} onClose={() => setPlayerModal(false)}/>
      <ResetPrompt open={resetModal} confirm={clearAllPoints} onClose={() => setResetModal(false)}/>

    </div>
  );
}

export default App;
