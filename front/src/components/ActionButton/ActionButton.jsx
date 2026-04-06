import PropTypes from 'prop-types';
import styles from './ActionButton.module.css';

const ActionButton = ({ label, onClick, variant = 'blue', size = 'sm', disabled = false, ...props }) => {
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles[variant]} ${styles[size]}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {label}
    </button>
  );
};

ActionButton.propTypes = {
  label:    PropTypes.string.isRequired,
  onClick:  PropTypes.func.isRequired,
  variant:  PropTypes.oneOf(['blue', 'red', 'white', 'black']),
  size:     PropTypes.oneOf(['xs', 'sm', 'md']),
  disabled: PropTypes.bool,
};

export default ActionButton;
