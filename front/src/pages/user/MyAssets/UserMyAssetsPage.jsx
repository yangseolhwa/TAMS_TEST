import { useState } from 'react'
import { InfoCircleFill } from 'react-bootstrap-icons'
import styles from './UserMyAssetsPage.module.css'

const INNER_TABS = [
  { id: 'request', label: '자산 등록 요청' },
  { id: 'status', label: '자산 요청 현황' },
]

const UserMyAssetsPage = () => {
  const [activeTab, setActiveTab] = useState(INNER_TABS[0].id)

  const today = new Date()
  const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className={styles.page}>

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>내 자산 관리</h1>
          <p className={styles.pageDesc}>소프트웨어 및 PC 장비 자산을 조회하고 관리하세요.</p>
        </div>
        <span className={styles.pageDate}>{formattedDate} 기준</span>
      </div>

      {/* 내부 탭 + 컨텐츠 */}
      <div className={styles.card}>
        <div className={styles.innerTabs}>
          {INNER_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.innerTab} ${activeTab === tab.id ? styles.innerTabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === INNER_TABS[0].id && (
            <>
              {/* 안내 배너 */}
              <div className={styles.banner}>
                <InfoCircleFill className={styles.bannerIcon} />
                <p className={styles.bannerText}>
                  소프트웨어 및 PC 장비를 최대 <strong>5개</strong>까지 동시에 요청할 수 있습니다.
                  처리 상태는 <strong>자산 요청 현황</strong>에서 확인하세요.
                </p>
              </div>
            </>
          )}
          {activeTab === INNER_TABS[1].id && <p>자산 요청 현황 영역</p>}
        </div>
      </div>

    </div>
  )
}

export default UserMyAssetsPage
