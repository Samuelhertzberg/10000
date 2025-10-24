import { Dialog, DialogActions, DialogContent, DialogTitle, Slide, Typography, Box, Divider } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import React from 'react';
import DialogButton from './Components/DialogButton';
import { Dice, DiceRow } from './Components/Dice';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

type Props = {
    open: boolean;
    onClose: () => void;
}

const HelpDialog: React.FC<Props> = ({ open, onClose }) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            TransitionComponent={Transition}
            disableRestoreFocus
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle>
                How to Play 10000
            </DialogTitle>
            <DialogContent>
                <Typography variant="h6" gutterBottom>
                    Objective
                </Typography>
                <Typography paragraph>
                    Be the first player to reach 10,000 points by rolling dice and scoring combinations.
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                    Scoring
                </Typography>
                <Box sx={{ pl: 2 }}>
                    <Typography paragraph>
                        <strong>Single Dice:</strong>
                    </Typography>
                    <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            Each <Dice value={1} /> = 100 points
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            Each <Dice value={5} /> = 50 points
                        </Box>
                    </Box>

                    <Typography paragraph sx={{ mt: 2 }}>
                        <strong>Three of a Kind:</strong>
                    </Typography>
                    <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DiceRow values={[1, 1, 1]} /> = 1,000 points
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DiceRow values={[2, 2, 2]} /> = 200 points
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DiceRow values={[3, 3, 3]} /> = 300 points
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DiceRow values={[4, 4, 4]} /> = 400 points
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DiceRow values={[5, 5, 5]} /> = 500 points
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DiceRow values={[6, 6, 6]} /> = 600 points
                        </Box>
                    </Box>

                    <Typography paragraph sx={{ mt: 2 }}>
                        <strong>More than three dice?</strong>
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DiceRow values={[2, 2, 2, 2]} /> = 400 points
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DiceRow values={[2, 2, 2, 2, 2]} /> = 800 points
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DiceRow values={[2, 2, 2, 2, 2, 2]} /> = 1600 points
                    </Box>

                    <Typography paragraph sx={{ mt: 2 }}>
                        <strong>Special Combinations:</strong>
                    </Typography>
                    <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <DiceRow values={[1, 2, 3, 4, 5, 6]} /> = 1,500 points
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <DiceRow values={[1, 1, 2, 2, 3, 3]} /> = 1,000 points
                        </Box>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                    How to Play
                </Typography>
                <Typography component="div" paragraph>
                    1. On your turn, roll all 6 dice<br />
                    2. Set aside any number of scoring dice<br />
                    3. You can either:<br />
                    <Box sx={{ pl: 3 }}>
                        Stop and bank your points<br />
                        Roll the remaining dice to try to score more
                    </Box>
                    4. If all 6 dice score, you can roll all 6 again<br />
                    5. If you roll and get no scoring dice, you lose all points for that turn
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                    Important Rules
                </Typography>
                <Typography component="div" paragraph>
                    If you have no points, you must score at least 10000 points to get on the board.<br />
                </Typography>
                <Typography component="div" paragraph>
                    When one player reaches 10,000 points, all other players get one final turn to try and beat that score.
                </Typography>
            </DialogContent>
            <DialogActions>
                <DialogButton onClick={onClose} positive>
                    Got it!
                </DialogButton>
            </DialogActions>
        </Dialog>
    );
};

export default HelpDialog;
