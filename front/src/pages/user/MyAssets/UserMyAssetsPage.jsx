import styles from './UserMyAssetsPage.module.css'

const UserMyAssetsPage = () => {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <div className={styles.page}>

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>내 자산 관리</h1>
          <p className={styles.pageDesc}>소프트웨어 및 PC 장비 자산을 조회하고 관리하세요.</p>
        </div>
        <span className={styles.pageDate}>{today} 기준</span>
      </div>

    </div>
  )
}

export default UserMyAssetsPage