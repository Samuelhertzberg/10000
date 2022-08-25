import React from 'react';
import PlayerRow from './PlayerRow/PlayerRow'

const PlayerList = ({players, getColors, addPoints, removePlayer}) => { 
    return (
        <div className='playerList'>
            { players.map((player, i) => {
                const {primary, secondary} = getColors(player.name)
                return (
                    <PlayerRow
                        key={"player_" + player.name}
                        name={player.name}
                        points={player.points}
                        addPoints={addPoints}
                        index={i}
                        primaryColor={primary}
                        secondaryColor={secondary}
                        removePlayer={() => removePlayer(player.name)}
                    />
                )
            })}
        </div>
    );
}
 
export default PlayerList;