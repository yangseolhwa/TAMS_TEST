import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "react-bootstrap-icons";
import PropTypes from "prop-types";
import styles from "./BackButton.module.css";

const BackButton = ({ label, to }) => {
  const navigate = useNavigate();

  return (
    <button className={styles.backBtn} onClick={() => navigate(to)}>
      <ArrowLeft size={13} /> {label}
    </button>
  );
};

BackButton.propTypes = {
  label: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
};

export default BackButton;
