import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Slide, TextField } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import React from 'react';

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
    return (
        <Dialog open={open} onClose={onClose} TransitionComponent={Transition} disableRestoreFocus
        >
            <DialogTitle>
                Enter a name
            </DialogTitle>
            <DialogContent sx={{
                py: 1
            }}>
                <TextField
                    label="Player name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    size="small"
                    sx={{
                        mt: 1
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={() => {
                    onAdd(name)
                    setName('')
                    onClose()
                }}>
                    Add
                </Button>
            </DialogActions>
        </Dialog>
    )
};

export default AddPlayerDialog;