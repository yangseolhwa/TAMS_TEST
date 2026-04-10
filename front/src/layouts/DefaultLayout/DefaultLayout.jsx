import { useState } from 'react'
import logoImg from '../../assets/logo.png'
import { PersonCircle, ChevronLeft, ChevronRight } from 'react-bootstrap-icons'
import { logout } from '../../services/authService'
import styles from './DefaultLayout.module.css'
import toast from 'react-hot-toast'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'

const TABS_BY_ROLE = {
  admin: [
    {
      id: 'my-assets',
      label: '내 자산 관리',
      menus: [
        { id: 'my-assets-list',            label: '내 자산 현황', path: 'my-assets'        },
        { id: 'my-assets-request',         label: '내 자산 등록',        path: 'request'          },
        { id: 'my-assets-request-history', label: '내 자산 요청 내역',        path: 'request-history'  },
        { id: 'my-assets-history',         label: '내 자산 히스토리',    path: 'history'          },
      ],
    },
    {
      id: 'df-assets',
      label: 'DF 자산 관리',
      menus: [
        { id: 'df-dashboard', label: 'DF 자산 현황',     path: 'dashboard'  },
        { id: 'df-register',  label: 'DF 자산 등록',     path: 'register'   },
        { id: 'df-history',   label: 'DF 자산 히스토리', path: 'history'    },
      ],
    },
  ],
  user: [
    {
      id: 'my-assets',
      label: '내 자산 관리',
      menus: [
        { id: 'my-assets-list',    label: '내 자산 현황', path: 'my-assets' },
        { id: 'my-assets-request', label: '내 자산 등록 요청',        path: 'request'   },
        { id: 'my-assets-history', label: '내 자산 요청 내역',        path: 'history'   },
      ],
    },
    {
      id: 'df-assets',
      label: 'DF 자산 관리',
      menus: [
        { id: 'df-dashboard', label: 'DF 자산 현황',     path: 'dashboard'  },
        { id: 'df-register',  label: 'DF 자산 등록',     path: 'register'   },
        { id: 'df-history',   label: 'DF 자산 히스토리', path: 'history'    },
      ],
    },
  ],
  df: [
    {
      id: 'my-assets',
      label: '내 자산 관리',
      menus: [
        { id: 'my-assets-list',    label: '내 자산 항목조회', path: 'my-assets' },
        { id: 'my-assets-history', label: '자산 히스토리',    path: 'history'   },
      ],
    },
    {
      id: 'df-assets',
      label: 'DF 자산 관리',
      menus: [
        { id: 'df-dashboard', label: 'DF 자산 현황',     path: 'dashboard'  },
        { id: 'df-register',  label: 'DF 자산 등록',     path: 'register'   },
        { id: 'df-history',   label: 'DF 자산 히스토리', path: 'history'    },
      ],
    },
  ],
}

const DefaultLayout = ({ role, onLogout }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const TABS = TABS_BY_ROLE[role] ?? TABS_BY_ROLE['user']
  const activeTab = TABS.find((tab) => location.pathname.split('/').includes(tab.id)) ?? TABS[0]

  const handleLogout = async () => {
    try {
      await logout()
      onLogout?.()
    } catch (err) {
      console.error(err.message)
      toast.dismiss('logout-error')
      setTimeout(() => {
        toast.error('로그아웃 중 오류가 발생했습니다. 다시 시도해 주세요.', {
          id: 'logout-error',
          duration: 3000,
        })
      }, 100)
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
              className={`${styles.tab} ${activeTab.id === tab.id ? styles.tabActive : ''}`}
              onClick={() => navigate(`/${role}/${tab.id}${tab.id === 'df-assets' ? '/dashboard' : ''}`)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Body (Sidebar + Content) */}
      <div className={styles.body}>

        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
          <div className={styles.sidebarInner}>
            <div className={styles.sidebarHeader}>
              <span className={styles.sidebarTitle}>{activeTab.label}</span>
              <button
                className={styles.sidebarToggle}
                onClick={() => setSidebarOpen(false)}
              >
                <ChevronLeft />
              </button>
            </div>
            <ul className={styles.sidebarMenu}>
              {activeTab.menus.map((menu) => (
                <li key={menu.id}>
                  <Link
                    to={`/${role}/${activeTab.id}/${menu.path}`}
                    className={`${styles.sidebarMenuItem} ${location.pathname.endsWith('/' + menu.path) ? styles.sidebarMenuItemActive : ''}`}
                  >
                    <span className={styles.sidebarMenuDot} />
                    <span className={styles.sidebarMenuLabel}>{menu.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* 닫혔을 때 토글 버튼 */}
        {!sidebarOpen && (
          <button
            className={styles.sidebarOpenBtn}
            onClick={() => setSidebarOpen(true)}
          >
            <ChevronRight />
          </button>
        )}

        {/* Main Content */}
        <main className={styles.main}>
          <Outlet />
        </main>

      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        {/* 푸터 영역 */}
      </footer>

    </div>
  )
}

export default DefaultLayout
