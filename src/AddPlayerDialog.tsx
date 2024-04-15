import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, Slide, Snackbar, TextField } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import React from 'react';
import DialogButton from './Components/DialogButton';

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
    onAdd: (name: string) => void;
}

const AddPlayerDialog: React.FC<Props> = ({
    open,
    onClose,
    onAdd,

}) => {
    const [name, setName] = React.useState('' as string)
    const [error, setError] = React.useState('')

    const handleAdd = () => {
        if (name.length <= 0) {
            setError('Please enter a name')
        } else {
            onAdd(name)
            setName('')
            onClose()
        }
    }

    return (
        <>
            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                <Alert severity="error" onClose={() => setError('')}>
                    {error}
                </Alert>
            </Snackbar>
            <Dialog open={open} onClose={onClose} TransitionComponent={Transition} disableRestoreFocus fullWidth>
                <DialogTitle>
                    Enter a name
                </DialogTitle>
                <DialogContent>
                    <TextField
                        label="Player name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={!!error}
                        autoFocus
                        size="small"
                        variant='standard'
                        fullWidth
                        color='secondary'
                    />
                </DialogContent>
                <DialogActions>
                    <DialogButton onClick={onClose}>Cancel</DialogButton>
                    <DialogButton onClick={handleAdd} positive>
                        Add
                    </DialogButton>
                </DialogActions>
            </Dialog>
        </>
    )
};

export default AddPlayerDialog;