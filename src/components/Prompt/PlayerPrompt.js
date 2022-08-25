import Modal from 'react-modal';
import './Prompt.css';

const customStyles = {
  content: {
    top: '15%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: "80%",
    border: "15px",
  },
};
Modal.setAppElement('#root');

const Prompt = ({open, onSubmit, onClose}) => {

    const onSubmitForm = (e) => {
        onSubmit(e.target[0].value);
    }
    
    return (
        <Modal
            isOpen={open}
            style={customStyles}
        >
            <div className="promptTitle">Enter a name</div>
            <form onSubmit={onSubmitForm}>
                <input className="promptInput" autoFocus/>
                <div className='promptButtonRow'>
                    <button className="promptButton addButton" type='submit' >Add Player</button>
                    <button className="promptButton cancelButton" onClick={onClose}>Cancel</button>
                </div>
            </form>
      </Modal>
    );
}

export default Prompt;