import styles from "./TabCard.module.css";

const TabCard = ({ tabs, activeTab, onTabChange, children }) => {
  return (
    <div className={styles.card}>
      <div className={styles.innerTabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.innerTab} ${activeTab === tab.id ? styles.innerTabActive : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};

export default TabCard;