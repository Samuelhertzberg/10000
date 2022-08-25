import {useState} from 'react';
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

const Prompt = ({open, onSubmit, onClose, buttonText="Add"}) => {
    const [points, setPoints] = useState(0);
    const onChange = (e) => {
        setPoints(e.target.value);
    }
    const onPressSubmit= (e) => {
        onSubmit(e.target.name == "add" ? points : -points)
    }

    return (
        <Modal
            isOpen={open}
            style={customStyles}
        >
            <div className="promptTitle">Enter Points</div>
            <input  type="tel" className="promptInput" onChange={onChange} autoFocus/>
            <div className='promptButtonRow'>
                <button className="promptButton addButton" type='submit' name="add" onClick={onPressSubmit}>Add</button>
                <button className="promptButton subtractButton" type='submit' name="subtract" onClick={onPressSubmit}>Subtract</button>
                <button className="promptButton cancelButton" onClick={onClose}>Cancel</button>
            </div>
      </Modal>
    );
}

export default Prompt;