import { useState, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'react-bootstrap-icons'
import PageHeader from '../../components/PageHeader/PageHeader'
import Card from '../../components/Card/Card'
import styles from './DfDashboardPage.module.css'

// ── 임시 목업 데이터 (API 연동 전) ───────────────────────────────────────────
const MOCK_PROJECTS = [
  {
    id: 1,
    name: 'A 프로젝트',
    items: [
      { itemType: '노트북', quantity: 5 },
      { itemType: '모니터', quantity: 10 },
      { itemType: '마우스', quantity: 8 },
    ],
  },
  {
    id: 2,
    name: 'B 프로젝트',
    items: [
      { itemType: '서버',   quantity: 3 },
      { itemType: '스위치', quantity: 2 },
    ],
  },
  {
    id: 3,
    name: 'C 프로젝트',
    items: [
      { itemType: '태블릿', quantity: 7 },
      { itemType: '키보드', quantity: 6 },
      { itemType: '헤드셋', quantity: 4 },
    ],
  },
]
// ─────────────────────────────────────────────────────────────────────────────

const DfDashboardPage = ({ role }) => {
  const navigate = useNavigate()

  // 현재 열린 프로젝트 id
  const [openId, setOpenId] = useState(new Set())

  // 아코디언 패널 높이 측정용
  const panelRefs     = useRef({})
  const [panelHeights, setPanelHeights] = useState({})

  useLayoutEffect(() => {
    const heights = {}
    MOCK_PROJECTS.forEach((p) => {
      if (panelRefs.current[p.id]) {
        heights[p.id] = panelRefs.current[p.id].scrollHeight
      }
    })
    setPanelHeights(heights)
  }, [])

  const totalEquipment = MOCK_PROJECTS.reduce(
    (sum, p) => sum + p.items.reduce((s, i) => s + i.quantity, 0),
    0,
  )

  const handleToggle      = (id) => setOpenId((prev) => { const next = new Set(prev); prev.has(id) ? next.delete(id) : next.add(id); return next; })
  const handleAllView     = () => navigate(`/${role}/df-assets/list`)
  const handleProjectView = (projectId, e) => {
    e.stopPropagation()
    navigate(`/${role}/df-assets/by-project`, { state: { projectId } })
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="DF 자산 현황"
        desc="DF 자산의 프로젝트별 현황을 조회합니다."
      />

      <section className={styles.section}>
        {/* 타이틀 바 */}
        <div className={styles.titleBar}>
          <div className={styles.titleLeft}>
            <span className={styles.titleText}>전체 프로젝트 현황</span>
            <button type="button" className={styles.viewBtn} onClick={handleAllView}>
              조회 &gt;
            </button>
          </div>
          <span className={styles.titleCount}>총 {totalEquipment}건</span>
          <span />
        </div>

        <Card>
          {/* 컬럼 헤더 */}
          <div className={styles.header}>
            <span className={styles.headerName}>프로젝트명</span>
            <span className={styles.headerCount}>총 장비 수</span>
            <span />
          </div>

          {/* 프로젝트 아코디언 목록 */}
          <ul className={styles.list}>
            {MOCK_PROJECTS.map((project) => {
              const isOpen    = openId.has(project.id)
              const projTotal = project.items.reduce((s, i) => s + i.quantity, 0)

              return (
                <li key={project.id} className={styles.item}>
                  {/* 프로젝트 행 */}
                  <div
                    className={`${styles.row} ${isOpen ? styles.rowOpen : ''}`}
                    onClick={() => handleToggle(project.id)}
                  >
                    <span className={styles.projectLeft}>
                      <span className={styles.projectName}>{project.name}</span>
                      <button
                        type="button"
                        className={styles.projectViewBtn}
                        onClick={(e) => handleProjectView(project.id, e)}
                      >
                        조회 &gt;
                      </button>
                    </span>
                    <span className={styles.projectCount}>{projTotal}</span>
                    <span className={styles.rowRight}>
                      <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </span>
                  </div>

                  {/* 장비 목록 패널 (아코디언) */}
                  <div
                    ref={(el) => (panelRefs.current[project.id] = el)}
                    className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
                    style={{ maxHeight: isOpen ? (panelHeights[project.id] ?? 0) + 'px' : '0px' }}
                  >
                    {/* 장비 헤더 */}
                    <div className={styles.itemHeader}>
                      <span className={styles.itemHeaderName}>장비 종류</span>
                      <span className={styles.itemHeaderCount}>수량 (EA)</span>
                      <span />
                    </div>
                    {/* 장비 행 */}
                    {project.items.map((item) => (
                      <div key={item.itemType} className={styles.itemRow}>
                        <span className={styles.itemName}>{item.itemType}</span>
                        <span className={styles.itemCount}>{item.quantity}</span>
                        <span />
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>
    </div>
  )
}

export default DfDashboardPage
