import logoImg from '../../assets/logo.png'
import { PersonCircle } from 'react-bootstrap-icons'
import styles from './DefaultLayout.module.css'

const DefaultLayout = ({ children }) => {
  return (
    <div className={styles.wrapper}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLogo}>
          <img src={logoImg} alt="TBOG" className={styles.logoImg} />
        </div>
        <div className={styles.headerRight}>
          <div className={styles.profile}>
            <PersonCircle className={styles.profileIcon} />
            <span className={styles.profileName}>김철수 님</span>
          </div>
          <button className={styles.logoutBtn}>로그아웃</button>
        </div>
      </header>

      {/* Navigation Tab Bar */}
      <nav className={styles.nav}>
        <div className={styles.navTabs}>
          <button className={`${styles.tab} ${styles.tabActive}`}>내 자산 관리</button>
          <button className={styles.tab}>DF 자산 관리</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.main}>
        {children}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        {/* 푸터 영역 */}
      </footer>

    </div>
  )
}

export default DefaultLayout