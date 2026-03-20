import { InfoCircleFill } from "react-bootstrap-icons";
import styles from "./Banner.module.css";
import PropTypes from 'prop-types';

const Banner = ({ text }) => {
  return (
    <div className={styles.banner}>
      <InfoCircleFill className={styles.bannerIcon} />
      <p className={styles.bannerText}>{text}</p>
    </div>
  );
};

Banner.propTypes = {
  text: PropTypes.node.isRequired,
};

export default Banner;