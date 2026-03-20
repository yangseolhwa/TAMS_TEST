import styles from "./PageHeader.module.css";

const PageHeader = ({ title, desc }) => {
  const today = new Date();
  const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderLeft}>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageDesc}>{desc}</p>
      </div>
      <span className={styles.pageDate}>{formattedDate} 기준</span>
    </div>
  );
};

export default PageHeader;