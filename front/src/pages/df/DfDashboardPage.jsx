import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader/PageHeader'
import Card from '../../components/Card/Card'
import styles from './DfDashboardPage.module.css'

// ── 임시 목업 데이터 (API 연동 전) ───────────────────────────────────────────
const MOCK_PROJECTS = [
  {
    id: 1,
    name: 'A 프로젝트',
    items: [
      { itemType: '노트북',     quantity: 5 },
      { itemType: '모니터',     quantity: 10 },
      { itemType: '마우스',     quantity: 8 },
      { itemType: '키보드',     quantity: 6 },
      { itemType: '웹캠',       quantity: 3 },
      { itemType: 'USB 허브',   quantity: 4 },
    ],
  },
  {
    id: 2,
    name: 'B 프로젝트',
    items: [
      { itemType: '서버',   quantity: 3 },
      { itemType: '스위치', quantity: 2 },
      { itemType: '라우터', quantity: 1 },
      { itemType: 'UPS',    quantity: 2 },
      { itemType: '케이블', quantity: 20 },
      { itemType: '랙',     quantity: 1 },
    ],
  },
  {
    id: 3,
    name: 'C 프로젝트',
    items: [
      { itemType: '태블릿',   quantity: 7 },
      { itemType: '키보드',   quantity: 6 },
      { itemType: '헤드셋',   quantity: 4 },
      { itemType: '충전기',   quantity: 8 },
      { itemType: '스타일러스', quantity: 5 },
      { itemType: '케이스',   quantity: 7 },
    ],
  },
  {
    id: 4,
    name: 'D 프로젝트',
    items: [
      { itemType: '프린터', quantity: 2 },
      { itemType: '스캐너', quantity: 1 },
      { itemType: '복합기', quantity: 3 },
    ],
  },
  {
    id: 5,
    name: 'E 프로젝트',
    items: [
      { itemType: '데스크탑', quantity: 12 },
      { itemType: '모니터',   quantity: 15 },
      { itemType: '마우스',   quantity: 12 },
      { itemType: '키보드',   quantity: 12 },
      { itemType: '헤드셋',   quantity: 6 },
      { itemType: 'NAS',      quantity: 2 },
    ],
  },
  {
    id: 6,
    name: 'F 프로젝트',
    items: [
      { itemType: '카메라', quantity: 4 },
      { itemType: '삼각대', quantity: 4 },
      { itemType: '조명',   quantity: 8 },
      { itemType: '마이크', quantity: 6 },
    ],
  },
]
// ─────────────────────────────────────────────────────────────────────────────

const DfDashboardPage = ({ role }) => {
  const navigate = useNavigate()

  const totalProjects  = MOCK_PROJECTS.length
  const totalEquipment = MOCK_PROJECTS.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + i.quantity, 0),
    0,
  )

  const handleAllView     = () => navigate(`/${role}/df-assets/list`)
  const handleProjectView = (projectId) => navigate(`/${role}/df-assets/by-project`, { state: { projectId } })

  return (
    <div className={styles.page}>
      <PageHeader
        title="DF 자산 현황"
        desc="DF 자산의 프로젝트별 현황을 조회합니다."
      />

      <div className={styles.grid}>

        {/* 전체 프로젝트 요약 카드 */}
        <Card className={styles.overviewCard}>
          <div className={styles.overviewTitleRow}>
            <span className={styles.overviewTitle}>전체 프로젝트</span>
            <span className={styles.overviewCount}>
              프로젝트 {totalProjects}개 · 총 {totalEquipment}대
            </span>
          </div>
          <button type="button" className={styles.overviewMoreBtn} onClick={handleAllView}>
            더보기 &gt;
          </button>
        </Card>

        {/* 프로젝트별 카드 */}
        {MOCK_PROJECTS.map((project) => {
          const projTotal     = project.items.reduce((s, i) => s + i.quantity, 0)
          const itemTypeCount = project.items.length

          return (
            <Card key={project.id} className={styles.projectCard}>
              {/* 카드 헤더 */}
              <div className={styles.projectCardHeader}>
                <div className={styles.projectCardLeft}>
                  <span className={styles.projectCardTitle}>{project.name}</span>
                  <span className={styles.projectCardCount}>장비 {itemTypeCount}종 · {projTotal}대</span>
                </div>
                <button
                  type="button"
                  className={styles.moreBtnOnDark}
                  onClick={() => handleProjectView(project.id)}
                >
                  더보기 &gt;
                </button>
              </div>

              {/* 테이블 헤더 */}
              <div className={styles.tableHeader}>
                <span className={styles.tableHeaderCell}>구분</span>
                <span className={styles.tableHeaderCell}>수량(EA)</span>
              </div>

              {/* 테이블 바디 */}
              <div className={styles.tableBody}>
                {project.items.map((item) => (
                  <div key={item.itemType} className={styles.tableRow}>
                    <span className={styles.tableCell}>{item.itemType}</span>
                    <span className={styles.tableCellRight}>{item.quantity}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}

      </div>
    </div>
  )
}

export default DfDashboardPage
