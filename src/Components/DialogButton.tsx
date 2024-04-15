import React from 'react';
import Button, { ButtonProps } from '@mui/material/Button';

interface DialogButtonProps extends ButtonProps {
    positive?: boolean;
}

const DialogButton: React.FC<DialogButtonProps> = ({ positive, ...props }) => {
    return (
        <Button {...props} sx={{
            ...props.sx,
            borderRadius: 50,
            backgroundColor: positive ? 'success.main' : 'error.light',
            '&:hover': {
                backgroundColor: positive ? 'success.dark' : 'error.dark',
            }
        }}>
            {props.children}
        </Button>
    );
};

export default DialogButton;