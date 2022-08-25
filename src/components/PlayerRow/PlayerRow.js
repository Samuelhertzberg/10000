import React from 'react';
import './PlayerRow.css'
import PointsPrompt from '../Prompt/PointsPrompt';
import {useSwipeable} from 'react-swipeable';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

const PlayerRow = ({name, points, addPoints, primaryColor, secondaryColor, removePlayer}) => {
    const [modalIsOpen, setIsOpen] = React.useState(false);
    const [deleteWidth, setDeleteWidth] = React.useState(0);
    const [lastSwipe, setLastSwipe] = React.useState(0);
    const onSubmitPoints = (points) => {
        setIsOpen(false);
        addPoints(name, points);
    }

    const handlers = useSwipeable({
        onSwiped: (eventData) => {
            const deltaX = eventData.deltaX;
            if(deltaX < -(window.screen.availWidth * 0.8)){
                removePlayer()
            }
            setDeleteWidth(0)
        },
        onSwiping: (eventData) => {
            const deltaX = eventData.deltaX;
            const currentTime = new Date().getTime();
            const timeSinceLastSwipe = currentTime - lastSwipe;
            if(timeSinceLastSwipe > 100 && deltaX < 0){
                setDeleteWidth(Math.abs(deltaX*1.2));
                setLastSwipe(currentTime);
            }
        }
    });

    return (
        <div {...handlers} className='playerRow' style={{backgroundColor: primaryColor}} >
            <div className='displayDiv'>
                <div className='nameDiv'>
                    {name}
                </div>
                <div className='pointsDiv'>
                    {points.reduce((a, b) => (a + b), 0)}
                </div>
            </div>
            <button className='addPointsButton' style={{backgroundColor: secondaryColor}} onClick={() => setIsOpen(true)}>
                +
            </button>
            <div className='deleteBar' style={{width:  deleteWidth}}>
                <DeleteForeverIcon sx={{ fontSize: '7vh', color: 'rgba(255, 255, 255, 0.7)'}}/>&nbsp;&nbsp;&nbsp;
            </div>
            <PointsPrompt open={modalIsOpen} onSubmit={onSubmitPoints} onClose={() => setIsOpen(false)}/>
        </div>
    );
}
 
export default PlayerRow;