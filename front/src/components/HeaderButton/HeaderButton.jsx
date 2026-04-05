import PropTypes from 'prop-types';
import styles from './HeaderButton.module.css';

const HeaderButton = ({ label, onClick, active, ...props  }) => {
  return (
    <button type="button" className={`${styles.headerBtn} ${active ? styles.headerBtnActive : ' '}`} onClick={onClick} {...props}>
      {label}
    </button>
  );
};

HeaderButton.propTypes = {
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  active: PropTypes.bool,
};

export default HeaderButton;
