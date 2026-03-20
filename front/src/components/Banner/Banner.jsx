import { InfoCircleFill } from "react-bootstrap-icons";
import styles from "./Banner.module.css";

const Banner = ({ text }) => {
  return (
    <div className={styles.banner}>
      <InfoCircleFill className={styles.bannerIcon} />
      <p className={styles.bannerText}>{text}</p>
    </div>
  );
};

export default Banner;