import React from 'react';
import './MainPageButton.css';

const AddPlayerButton = ({onClick, title, size}) => { 
    return (
        <div className={'MainPageButtonWrapper'}>
            <button className={'MainPageButton ' + size} onClick={onClick}>
                {title}
            </button>
        </div>
    );
}
 
export default AddPlayerButton;