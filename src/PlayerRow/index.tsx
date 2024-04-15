import { Box, IconButton, Slide, Stack, Typography, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import React, { useState } from 'react';
import { getPlayerColors } from '../utils';
import AddPointsDialog from './AddPointsDialog';
import SwipeableViews from 'react-swipeable-views';
import Color from 'color';
import { mdiDice6Outline, mdiSkullOutline } from '@mdi/js';
import Icon from '@mdi/react';


interface PlayerRowProps {
    name: string;
    score: number[];
    addPoints: (points: number) => void;
    onRemovePlayer: () => void;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ name, score, addPoints, onRemovePlayer }) => {
    const [dialogOpen, setDialogOpen] = useState(false)
    const color = getPlayerColors(name)
    const lightColor = Color(color).lighten(0.1).hex()
    const totalScore = score.reduce((a, b) => a + b, 0)
    const handleAddPoints = (points: number) => {
        addPoints(points)
        setDialogOpen(false)
    }

    const theme = useTheme()

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
                color: theme.palette.primary.main,
            }}>{text}</Typography>
            <Typography sx={{
                transform: 'rotate(180deg)',
                fontSize: '4vh',
                ml: 1,
                opacity: 0.5,
                color: theme.palette.primary.main,
            }}>{rotatedText}</Typography>
        </Stack>
    )

    return (
        <>

            <Slide direction="right" in={true} mountOnEnter>
                <Box>
                    <SwipeableViews index={0} onChangeIndex={handleChangeIndex} >
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            backgroundColor: color,
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
                                size='large'
                                sx={{
                                    backgroundColor: lightColor,
                                    aspectRatio: 1,
                                    borderRadius: 0,
                                }}
                                onClick={() => setDialogOpen(true)}
                            >
                                <AddIcon sx={{
                                    fontSize: '5vh',
                                    color: theme.palette.primary.main,
                                }} />
                            </IconButton>
                        </Box>
                        <Box sx={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: theme.palette.error.main,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Icon path={mdiSkullOutline} size={4} color={'rgba(255,255,255,0.5'} />
                            <Icon path={mdiDice6Outline} size={4} color={'rgba(255,255,255,0.5'} />
                            <Icon path={mdiSkullOutline} size={4} color={'rgba(255,255,255,0.5'} />
                            <Icon path={mdiDice6Outline} size={4} color={'rgba(255,255,255,0.5'} />
                        </Box>

                    </SwipeableViews>
                </Box>
            </Slide>
            <AddPointsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={handleAddPoints} playerPoints={score} />
        </>
    );
};

export default PlayerRow;