import { PersonCircle } from 'react-bootstrap-icons'
import styles from './DefaultLayout.module.css'

const DefaultLayout = ({ children }) => {
  return (
    <div className={styles.wrapper}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLogo}>
          <span className={styles.logoTitle}>
            <span className={styles.logoAccent}>T</span>AMS
          </span>
          <div className={styles.logoSubtitle}>
            <span>TBOG</span>
            <span>Asset Management System</span>
          </div>
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
          {/* 탭 추가 예정 */}
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