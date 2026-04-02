import PropTypes from 'prop-types';
import styles from './HeaderButton.module.css';

const HeaderButton = ({ label, onClick }) => {
  return (
    <button className={styles.headerBtn} onClick={onClick}>
      {label}
    </button>
  );
};

HeaderButton.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default HeaderButton;
