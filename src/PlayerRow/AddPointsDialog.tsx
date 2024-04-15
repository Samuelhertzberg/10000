import { Dialog, DialogTitle, DialogContent, DialogActions, Slide, Alert, Snackbar, Input } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import React, { useState } from 'react';
import DialogButton from '../Components/DialogButton';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});


type Props = {
    onClose: () => void;
    open: boolean;
    playerPoints: number[];
    onAdd: (points: number) => void;
}

const AddPointsDialog: React.FC<Props> = ({
    onClose,
    open,
    playerPoints,
    onAdd,
}) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [points, setPoints] = useState<number>(0)
    const [error, setError] = useState('')
    const playerScore = playerPoints.reduce((a, b) => a + b, 0)

    const onCancel = () => {
        setPoints(0)
        onClose()
    }


    const handleSubmit = (subtract = false) => {
        if (points === undefined) {
            setError('Please enter a number')
        } else if (points <= 0) {
            setError('Points must be a positive number')
        } else if (points % 50 !== 0) {
            setError('Points must be a multiple of 50, have you read the rules?')
        } else if (points > playerScore && subtract) {
            setError('You can\'t subtract more points than the player has')
        } else {
            if (subtract) {
                onAdd(-points)
            } else {
                onAdd(points)
            }
            setPoints(0)
            onClose()
        }
    }

    const handleSubtract = () => handleSubmit(true)
    const handleAdd = () => handleSubmit(false)

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseInt(e.target.value)
        if (!isNaN(parsed)) {
            setPoints(parsed)
        }
    }

    return (
        <>

            <Snackbar open={error !== ''} autoHideDuration={6000} onClose={() => setError('')}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>
            <Dialog open={open} onClose={onCancel} TransitionComponent={Transition} disableRestoreFocus fullWidth>
                <DialogTitle>
                    Add points
                </DialogTitle>
                <DialogContent sx={{
                    py: 1
                }}>
                    <Input
                        type='tel'
                        ref={inputRef}
                        error={error !== ''}
                        onChange={onChange}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        sx={{
                            mt: 1,
                        }}
                        fullWidth
                        color='secondary'
                    />
                </DialogContent>
                <DialogActions>
                    <DialogButton onClick={onCancel} sx={{
                        mr: 1,
                    }}>
                        Cancel
                    </DialogButton>
                    <DialogButton onClick={handleSubtract}>
                        Subtract
                    </DialogButton>
                    <DialogButton onClick={handleAdd} positive={true}>
                        Add
                    </DialogButton>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default AddPointsDialog;