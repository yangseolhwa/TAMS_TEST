import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader/PageHeader'
import Card from '../../components/Card/Card'
import { fetchDfDashboard } from '../../services/assetService'
import styles from './DfDashboardPage.module.css'
import common from '../AssetPage.common.module.css'

const DfDashboardPage = ({ role }) => {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['dfDashboard'],
    queryFn:  fetchDfDashboard,
  })

  const projects       = data?.projects       ?? []
  const totalProjects  = projects.length
  const totalEquipment = projects.reduce((sum, p) => sum + (p.total ?? 0), 0)

  // 모든 프로젝트의 장비 종류별 수량 합산 후 이름 오름차순 정렬
  const allItemTypes = (() => {
    const map = new Map()
    projects.forEach((proj) => {
      (proj.items ?? []).forEach((item) => {
        const prev = map.get(item.itemType) ?? 0
        map.set(item.itemType, prev + item.quantity)
      })
    })
    return [...map.entries()]
      .map(([itemType, quantity]) => ({ itemType, quantity }))
      .sort((a, b) => a.itemType.localeCompare(b.itemType, 'ko'))
  })()
  const totalItemTypes = allItemTypes.length

  const handleAllView     = () => navigate(`/${role}/df-assets/list`)
  // [DF-5 수정] state 대신 URL query param 사용 (새로고침 시에도 유지됨)
  const handleProjectView = (projectId) =>
    navigate(`/${role}/df-assets/by-project?project_id=${projectId}`)

  if (isLoading) {
    return (
      <div className={common.page}>
        <PageHeader title="DF 자산 현황" desc="DF 자산의 프로젝트별 현황을 조회합니다." />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className={common.page}>
      <PageHeader
        title="DF 자산 현황"
        desc="DF 자산의 프로젝트별 현황을 조회합니다."
      />

      <div className={styles.grid}>

        {/* 전체 프로젝트 요약 카드 */}
        <Card className={styles.projectCard}>
          <div className={styles.projectCardHeader}>
            <div className={styles.projectCardLeft}>
              <span className={styles.projectCardTitle}>전체 프로젝트</span>
              <span className={styles.projectCardCount}>
                프로젝트 {totalProjects}개 · 장비 {totalItemTypes}종 · {totalEquipment}대
              </span>
            </div>
            <button type="button" className={styles.moreBtnOnDark} onClick={handleAllView}>
              더보기 &gt;
            </button>
          </div>

          <div className={styles.tableHeader}>
            <span className={styles.tableHeaderCell}>구분</span>
            <span className={styles.tableHeaderCell}>수량(EA)</span>
          </div>

          <div className={styles.tableBody}>
            {allItemTypes.length === 0 ? (
              <div className={styles.tableRow}>
                <span className={styles.tableCell} style={{ color: 'var(--color-text-secondary)' }}>
                  데이터가 없습니다.
                </span>
              </div>
            ) : (
              allItemTypes.map((item) => (
                <div key={item.itemType} className={styles.tableRow}>
                  <span className={styles.tableCell}>{item.itemType}</span>
                  <span className={styles.tableCellRight}>{item.quantity}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 프로젝트별 카드 */}
        {projects.map((project) => {
          const sortedItems = [...(project.items ?? [])].sort(
            (a, b) => a.itemType.localeCompare(b.itemType, 'ko')
          )
          const itemTypeCount = sortedItems.length

          return (
            <Card key={project.id} className={styles.projectCard}>
              <div className={`${styles.projectCardHeader} ${project.end_project ? styles.projectCardHeaderEnded : ''}`}>
                <div className={styles.projectCardLeft}>
                  <span className={styles.projectCardTitle}>{project.name}</span>
                  <span className={styles.projectCardCount}>
                    장비 {itemTypeCount}종 · {project.total ?? 0}대
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.moreBtnOnDark}
                  onClick={() => handleProjectView(project.id)}
                >
                  더보기 &gt;
                </button>
              </div>

              <div className={styles.tableHeader}>
                <span className={styles.tableHeaderCell}>구분</span>
                <span className={styles.tableHeaderCell}>수량(EA)</span>
              </div>

              <div className={styles.tableBody}>
                {sortedItems.length === 0 ? (
                  <div className={styles.tableRow}>
                    <span className={styles.tableCell} style={{ color: 'var(--color-text-secondary)' }}>
                      데이터가 없습니다.
                    </span>
                  </div>
                ) : (
                  sortedItems.map((item) => (
                    <div key={item.itemType} className={styles.tableRow}>
                      <span className={styles.tableCell}>{item.itemType}</span>
                      <span className={styles.tableCellRight}>{item.quantity}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )
        })}

      </div>
    </div>
  )
}

export default DfDashboardPage