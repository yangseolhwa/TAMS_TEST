import PropTypes from 'prop-types';
import styles from './HeaderButton.module.css';

const HeaderButton = ({ label, onClick, ...props  }) => {
  return (
    <button type="button" className={styles.headerBtn} onClick={onClick} {...props}>
      {label}
    </button>
  );
};

HeaderButton.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default HeaderButton;
