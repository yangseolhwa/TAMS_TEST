import logoImg from '../../assets/logo.png'
import styles from './Logo.module.css'

const Logo = () => (
  <div className={styles.wrapper}>
    <img
      src={logoImg}
      alt="Company Logo"
      className={styles.img}
    />
  </div>
)

export default Logo