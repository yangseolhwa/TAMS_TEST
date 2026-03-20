import styles from "./TabCard.module.css";
import PropTypes from 'prop-types';

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

TabCard.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  children: PropTypes.node,
};

export default TabCard;