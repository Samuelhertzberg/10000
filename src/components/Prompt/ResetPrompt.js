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

const Prompt = ({open, confirm, onClose}) => {
    return (
        <Modal
            isOpen={open}
            style={customStyles}
        >
            <div className="promptTitle">Are you sure?</div>
            <div className='promptButtonRow'>
                <button className="promptButton addButton" onClick={confirm}>Yes</button>
                <button className="promptButton cancelButton" onClick={onClose}>No</button>
            </div>
      </Modal>
    );
}

export default Prompt;