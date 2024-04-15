import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

interface ConfirmationDialogProps {
    open: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    message,
    onConfirm,
    onCancel,
}) => {
    return (
        <Dialog open={open} onClose={onCancel}>
            <DialogTitle>Are you sure?</DialogTitle>
            {message.length > 0 && <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>}
            <DialogActions>
                <Button onClick={onCancel}>Nope</Button>
                <Button onClick={onConfirm}>Yep</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmationDialog;