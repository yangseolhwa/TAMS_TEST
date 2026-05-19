import { useState } from 'react'
import logoImg from '../../assets/logo.png'
import { PersonCircle, ChevronDown, ChevronUp, ChevronDoubleLeft, ChevronDoubleRight } from 'react-bootstrap-icons'
import { logout, switchRole } from '../../services/authService'
import Switch from 'react-switch'
import styles from './DefaultLayout.module.css'
import toast from 'react-hot-toast'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'

const TABS_BY_ROLE = {
  admin: [
    {
      id: 'my-assets',
      label: '내 자산 관리',
      menus: [
        { id: 'my-assets-list',            label: '내 자산 현황',     path: 'my-assets'       },
        { id: 'my-assets-request',         label: '내 자산 등록',     path: 'request'         },
        { id: 'my-assets-assign',          label: '내 자산 할당',     path: 'assign'          },
        { id: 'my-assets-request-history', label: '내 자산 요청 내역', path: 'request-history' },
        { id: 'my-assets-history',         label: '내 자산 히스토리', path: 'history'         },
      ],
    },
    {
      id: 'df-assets',
      label: 'DF 자산 관리',
      menus: [
        { id: 'df-dashboard', label: 'DF 자산 현황',     path: 'dashboard' },
        { id: 'df-register',  label: 'DF 자산 등록',     path: 'register'  },
        { id: 'df-history',   label: 'DF 자산 히스토리', path: 'history'   },
      ],
    },
  ],
  user: [
    {
      id: 'my-assets',
      label: '내 자산 관리',
      menus: [
        { id: 'my-assets-list',    label: '내 자산 현황',     path: 'my-assets' },
        { id: 'my-assets-request', label: '내 자산 등록 요청', path: 'request'   },
        { id: 'my-assets-assign',  label: '내 자산 할당 요청', path: 'assign'    },
        { id: 'my-assets-history', label: '내 자산 요청 내역', path: 'history'   },
      ],
    },
    {
      id: 'df-assets',
      label: 'DF 자산 관리',
      menus: [
        { id: 'df-dashboard', label: 'DF 자산 현황',     path: 'dashboard' },
        { id: 'df-register',  label: 'DF 자산 등록',     path: 'register'  },
        { id: 'df-history',   label: 'DF 자산 히스토리', path: 'history'   },
      ],
    },
  ],
}

const DefaultLayout = ({ role, name, hasLinkedAccount, onLogout, onRoleSwitch }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const TABS = TABS_BY_ROLE[role] ?? TABS_BY_ROLE['user']

  // 현재 활성 탭 (pathname 기준)
  const activeTab = TABS.find((tab) => location.pathname.split('/').includes(tab.id)) ?? TABS[0]

  // 사이드바 열림/닫힘
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // 대분류별 접힘/펼침 상태 (기본: 현재 활성 탭만 열림)
  const [openGroups, setOpenGroups] = useState(() => {
    const init = {}
    TABS.forEach((tab) => { init[tab.id] = tab.id === activeTab.id })
    return init
  })

  const toggleGroup = (tabId) => {
    setOpenGroups((prev) => ({ ...prev, [tabId]: !prev[tabId] }))
  }

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

  const handleRoleSwitch = async () => {
    try {
      const data = await switchRole()
      sessionStorage.setItem('role', data.role)
      sessionStorage.setItem('userName', data.name)
      onRoleSwitch(data.role, data.name)
      navigate(`/${data.role}/my-assets`, { replace: true })
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
          {hasLinkedAccount && (
            <div className={styles.roleToggleWrap} title={role === 'admin' ? 'User로 전환' : 'Admin으로 전환'}>
              <span className={`${styles.roleLabel} ${role !== 'admin' ? styles.roleLabelActive : ''}`}>User</span>
              <Switch
                checked={role === 'admin'}
                onChange={handleRoleSwitch}
                onColor="#1E2D45"
                offColor="#718096"
                uncheckedIcon={false}
                checkedIcon={false}
                height={20}
                width={36}
                handleDiameter={14}
              />
              <span className={`${styles.roleLabel} ${role === 'admin' ? styles.roleLabelActive : ''}`}>Admin</span>
            </div>
          )}
          <div className={styles.profileGroup}>
            <div className={styles.profile}>
              <PersonCircle className={styles.profileIcon} />
              <span className={styles.profileName}>{name}</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
      </header>

      {/* Body (Sidebar + Content) */}
      <div className={styles.body}>

        {/* Sidebar */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
          <div className={styles.sidebarInner}>

            {/* 닫기 버튼 */}
            <div className={styles.sidebarHeader}>
              <button className={styles.sidebarToggle} onClick={() => setSidebarOpen(false)}>
                <ChevronDoubleLeft size={14} />
              </button>
            </div>

            {/* 대분류 + 하위 메뉴 */}
            <nav className={styles.sidebarNav}>
              {TABS.map((tab) => {
                const isGroupOpen = openGroups[tab.id]
                return (
                  <div key={tab.id} className={styles.sidebarGroup}>
                    {/* 대분류 버튼 */}
                    <button
                      className={`${styles.sidebarGroupBtn} ${activeTab.id === tab.id ? styles.sidebarGroupBtnActive : ''}`}
                      onClick={() => toggleGroup(tab.id)}
                    >
                      <span className={styles.sidebarGroupLabel}>{tab.label}</span>
                      {isGroupOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {/* 하위 메뉴 */}
                    {isGroupOpen && (
                      <ul className={styles.sidebarMenu}>
                        {tab.menus.map((menu) => {
                          const to = menu.path === tab.id ? `/${role}/${tab.id}` : `/${role}/${tab.id}/${menu.path}`
                          const isActive = location.pathname === to
                          return (
                            <li key={menu.id}>
                              <Link
                                to={to}
                                className={`${styles.sidebarMenuItem} ${isActive ? styles.sidebarMenuItemActive : ''}`}
                              >
                                <span className={styles.sidebarMenuLabel}>{menu.label}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </nav>

          </div>
        </aside>

        {/* 닫혔을 때 토글 버튼 */}
        {!sidebarOpen && (
          <button className={styles.sidebarOpenBtn} onClick={() => setSidebarOpen(true)}>
            <ChevronDoubleRight size={14} />
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
