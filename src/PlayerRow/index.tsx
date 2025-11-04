import { Box, IconButton, Slide, Stack, Typography, useTheme, Collapse } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import React, { useState } from 'react';
import { getPlayerColors } from '../utils';
import AddPointsDialog from './AddPointsDialog';
import SwipeableViews from 'react-swipeable-views';
import Color from 'color';
import { mdiDice6Outline, mdiSkullOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Badge, BadgeLegend, BadgeType } from '../Components/Badge';
import { trackAddPoints, trackScoreExpansion } from '../analytics';


interface PlayerRowProps {
    name: string;
    score: number[];
    allowAnyPoints: boolean;
    maxPoints: number;
    badges: BadgeType[];
    addPoints: (points: number) => void;
    onRemovePlayer: () => void;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ name, score, allowAnyPoints, maxPoints, badges, addPoints, onRemovePlayer }) => {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [pointsExpanded, setPointsExpanded] = useState(false)
    const color = getPlayerColors(name)
    const lightColor = Color(color).lighten(0.1).hex()
    const totalScore = score.reduce((a, b) => a + b, 0)
    const handleAddPoints = (points: number) => {
        addPoints(points)
        trackAddPoints(points, name)
        setDialogOpen(false)
    }

    const theme = useTheme()

    const handleChangeIndex = (index: number) => {
        if (index !== 0) {
            onRemovePlayer()
        }
    }

    const PlayerInfo = ({ text, rotatedText, showBadges, showRotatedBadges }: { text: string | number, rotatedText: string | number, showBadges?: boolean, showRotatedBadges?: boolean }) => (
        <Stack direction="row" sx={{
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{
                    fontSize: 'inherit',
                }}>{text}</Typography>
                {showBadges && badges.map((badge) => (
                    <Badge key={badge} type={badge} size={0.7} color={theme.palette.primary.main} opacity={0.5} />
                ))}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, transform: 'rotate(180deg)', opacity: 0.5, color: theme.palette.primary.main }}>
                <Typography sx={{
                    fontSize: 'inherit',
                }}>{rotatedText}</Typography>
                {showRotatedBadges && badges.map((badge) => (
                    <Badge key={badge} type={badge} size={0.7} color={theme.palette.primary.main} opacity={0.5} />
                ))}
            </Box>
        </Stack>
    )

    const ScoreRow = ({ points, index }: { points: number, index: number }) => (
        <Stack direction="row" alignItems="end" justifyContent="end" width="100%">
            <Stack direction="row" sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                borderBottom: index === 0 ? `1px solid ${theme.palette.primary.main}` : 'none',
                borderTop: index === score.length - 1 ? `1px solid ${theme.palette.primary.main}` : 'none',
            }}>
                <Box sx={{ fontSize: '2vh' }} >
                    {index === 0 && "Last Round: "}
                    {index === score.length - 1 && "First Round: "}
                </Box>
                <Typography sx={{
                    fontSize: 'inherit',
                    color: theme.palette.primary.main,
                }}>
                    {Math.sign(points) >= 0 ? '+' : '-'}{' '}
                    {Math.abs(points)}
                </Typography>
            </Stack>
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
                            color: theme.palette.primary.main,
                        }}
                        >
                            <Stack direction="column" sx={{
                                justifyContent: 'space-between',
                                width: '100%',
                                p: 1,
                                px: 2,
                                overflow: 'hidden',
                            }}
                                onClick={() => {
                                    const newExpanded = !pointsExpanded
                                    setPointsExpanded(newExpanded)
                                    trackScoreExpansion(newExpanded)
                                }}

                            >
                                <PlayerInfo text={name} rotatedText={totalScore} showBadges={true} showRotatedBadges={false} />
                                <PlayerInfo text={totalScore} rotatedText={name} showBadges={false} showRotatedBadges={true} />

                                {
                                    <Collapse in={pointsExpanded} timeout="auto" unmountOnExit>
                                        <Stack direction="column" sx={{
                                            justifyContent: 'end',
                                            alignItems: 'end',
                                            width: '100%',
                                            mt: 1,
                                            fontSize: '3vh',
                                            opacity: 0.5,
                                        }}>
                                            {
                                                [...score].reverse().map((points, index) => <ScoreRow key={index} points={points} index={index} />)
                                            }
                                            {badges.length > 0 && (
                                                <Box sx={{
                                                    width: '100%',
                                                    mt: 2,
                                                    fontSize: '2vh',
                                                    color: theme.palette.primary.main,
                                                }}>
                                                    <BadgeLegend badges={badges} color={theme.palette.primary.main} />
                                                </Box>
                                            )}
                                        </Stack>
                                    </Collapse>

                                }
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
                                {
                                    totalScore < maxPoints ?
                                        <AddIcon sx={{
                                            fontSize: '5vh',
                                            color: theme.palette.primary.main,
                                        }} />
                                        :
                                        <Icon path={mdiDice6Outline} size={'5vh'} color={'rgba(255,255,255,0.5'} spin />
                                }
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
                            <Icon path={mdiSkullOutline} size={3} color={'rgba(255,255,255,0.5'} />
                            <Icon path={mdiDice6Outline} size={3} color={'rgba(255,255,255,0.5'} />
                            <Icon path={mdiSkullOutline} size={3} color={'rgba(255,255,255,0.5'} />
                            <Icon path={mdiDice6Outline} size={3} color={'rgba(255,255,255,0.5'} />
                        </Box>

                    </SwipeableViews>
                </Box>
            </Slide>
            <AddPointsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={handleAddPoints} playerPoints={score} allowAnyPoints={allowAnyPoints} />
        </>
    );
};

export default PlayerRow;