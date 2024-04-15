import { Box, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import React, { useState } from 'react';
import { getPlayerColors } from '../utils';
import AddPointsDialog from './AddPointsDialog';
import SwipeableViews from 'react-swipeable-views';

interface PlayerRowProps {
    name: string;
    score: number[];
    addPoints: (points: number) => void;
    onRemovePlayer: () => void;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ name, score, addPoints, onRemovePlayer }) => {
    const [dialogOpen, setDialogOpen] = useState(false)
    const { primary, secondary } = getPlayerColors(name)
    const totalScore = score.reduce((a, b) => a + b, 0)
    const handleAddPoints = (points: number) => {
        addPoints(points)
        setDialogOpen(false)
    }

    const handleChangeIndex = (index: number) => {
        if (index !== 0) {
            onRemovePlayer()
        }
    }

    const PlayerInfo = ({ text, rotatedText }: { text: string | number, rotatedText: string | number }) => (
        <Stack direction="row" sx={{
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
            <Typography sx={{
                fontSize: '4vh',
            }}>{text}</Typography>
            <Typography sx={{
                transform: 'rotate(180deg)',
                fontSize: '4vh',
                ml: 1,
                opacity: 0.5,
            }}>{rotatedText}</Typography>
        </Stack>
    )

    return (
        <>
            <SwipeableViews index={0} onChangeIndex={handleChangeIndex} >
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    backgroundColor: primary,
                    color: 'rgba(255, 255, 255, 0.87)',
                    fontSize: '4vh',
                    font: 'Roboto',
                }}>
                    <Stack direction="column" sx={{
                        justifyContent: 'space-between',
                        width: '100%',
                        p: 1,
                        px: 2,
                        overflow: 'hidden',
                    }}>
                        <PlayerInfo text={name} rotatedText={totalScore} />
                        <PlayerInfo text={totalScore} rotatedText={name} />
                    </Stack>
                    <IconButton
                        aria-label="delete"
                        size='large'
                        sx={{
                            color: 'white',
                            backgroundColor: secondary,
                            aspectRatio: 1,
                            borderRadius: 0,
                        }}
                        onClick={() => setDialogOpen(true)}
                    >
                        <AddIcon sx={{
                            fontSize: '5vh',
                            color: 'white',
                        }} />
                    </IconButton>
                </Box>
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'red'
                }} />

            </SwipeableViews>
            <AddPointsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={handleAddPoints} playerPoints={score} />
        </>
    );
};

export default PlayerRow;