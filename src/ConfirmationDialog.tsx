import React from 'react';
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import DialogButton from './Components/DialogButton';

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
                <DialogButton onClick={onCancel} positive>Nope</DialogButton>
                <DialogButton onClick={onConfirm}>Yep</DialogButton>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmationDialog;