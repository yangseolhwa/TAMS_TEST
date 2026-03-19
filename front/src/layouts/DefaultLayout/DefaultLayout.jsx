import { useState } from 'react'
import logoImg from '../../assets/logo.png'
import { PersonCircle } from 'react-bootstrap-icons'
import { logout } from '../../services/authService'
import styles from './DefaultLayout.module.css'

const TABS = [
  { id: 'my-assets', label: '내 자산 관리' },
  { id: 'df-assets', label: 'DF 자산 관리' },
]

const DefaultLayout = ({ children, role, onLogout }) => {
  const [activeTab, setActiveTab] = useState(TABS[0].id)

  const handleLogout = async () => {
    try {
      await logout()
      onLogout?.()
    } catch (err) {
      console.error(err.message)
    }
  }

  return (
    <div className={styles.wrapper}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLogo}>
          <img src={logoImg} alt="TAMS" className={styles.logoImg} />
        </div>
        <div className={styles.headerRight}>
          <div className={styles.profile}>
            <PersonCircle className={styles.profileIcon} />
            <span className={styles.profileName}>{role}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      {/* Navigation Tab Bar */}
      <nav className={styles.nav}>
        <div className={styles.navTabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
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