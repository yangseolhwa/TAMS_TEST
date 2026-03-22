import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import PageHeader from '../../../components/PageHeader/PageHeader'
import Card from '../../../components/Card/Card'
import DataTable from '../../../components/DataTable/DataTable'
import { fetchDfAssets } from '../../../services/assetService'
import styles from './UserDfAssetsPage.module.css'

// ─── 테이블 컬럼 정의 ───────────────────────────────────────────────────────
const DF_COLUMNS = [
  { key: 'no',               label: 'No'       },
  { key: 'project',          label: '프로젝트',  type: 'dash' },
  { key: 'doosanItemNumber', label: '두산',      type: 'dash' },
  { key: 'itemType',         label: '자산 종류', type: 'dash' },
  { key: 'modelName',        label: '자산명',    type: 'dash' },
  { key: 'manufacturer',     label: '제조사',    type: 'dash' },
  { key: 'serialNumber',     label: '시리얼',    type: 'dash' },
  { key: 'quantity',         label: '수량',      type: 'dash' },
  { key: 'rentalStartDate',  label: '등록일',    type: 'dash' },
  { key: 'rentalEndDate',    label: '반납일',    type: 'dash' },
  { key: 'location',         label: '위치',      type: 'dash' },
  { key: 'state',            label: '상태',      type: 'status' },
  { key: 'remarks',          label: '비고',      type: 'dash' },
]

// ─── 상태 뱃지 매핑 (백엔드 ENUM 소문자 기준) ─────────────────────────────
const DF_STATUS_MAP = {
  active: { label: '사용중',   color: 'green'  },
  stored: { label: '보관중',   color: 'blue'   },
  rented: { label: '외부대여', color: 'yellow' },
}

const PAGE_SIZE = 10

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────
const UserDfAssetsPage = () => {
  const [selectedIds,  setSelectedIds]  = useState([])
  const [currentPage,  setCurrentPage]  = useState(1)

  // ── React Query: DF 자산 조회 ──────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['dfAssets'],
    queryFn:  () => fetchDfAssets(),
  })

  // fetchDfAssets가 { rows, projectSummaries } 반환
  const allRows          = data?.rows             ?? []
  const projectSummaries = data?.projectSummaries ?? []

  // ── 전체 건수 ──
  const totalCount = allRows.length

  // ── 페이지네이션 ──────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // totalPages 축소 시 현재 페이지 보정
  const safePage = Math.min(currentPage, totalPages)

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return allRows.slice(start, start + PAGE_SIZE)
  }, [allRows, safePage])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    setSelectedIds([])
  }

  // ── 페이지 번호 배열 (최대 7개) ───────────────────────────────────────
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const half  = 3
    let start   = Math.max(1, safePage - half)
    let end     = Math.min(totalPages, safePage + half)
    if (end - start < 6) {
      if (start === 1) end   = Math.min(totalPages, 7)
      else             start = Math.max(1, end - 6)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [safePage, totalPages])

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <PageHeader
        title="DF 자산 관리"
        desc="DF 장비의 조회 및 위치 변동을 수행합니다."
      />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Search size={15} />
          <span>DF 자산 조회</span>
        </div>

        {/* ── 프로젝트 요약 카드 ─────────────────────────────────────── */}
        <div className={styles.projCards}>
          {/* 전체 카드 */}
          <div className={`${styles.projCard} ${styles.projCardTotal}`}>
            <div className={styles.projCardTitle}>전체 프로젝트</div>
            <div className={styles.projCardCount}>
              {isLoading ? '—' : totalCount}
              <span className={styles.projCardUnit}> 건</span>
            </div>
          </div>

          {/* 프로젝트별 카드 */}
          {!isLoading &&
            projectSummaries.map((proj) => (
              <div key={proj.id} className={styles.projCard}>
                <div className={styles.projCardTitle}>{proj.name}</div>
                <div className={styles.projCardCount}>
                  {proj.count}
                  <span className={styles.projCardUnit}> 건</span>
                </div>
              </div>
            ))}
        </div>

        {/* ── 자산 테이블 카드 ────────────────────────────────────────── */}
        <Card>
          {/* 액션 버튼 — MAIN03·MAIN04 단계에서 기능 구현 예정 */}
          <div className={styles.tableActions}>
            <button className={styles.moveBtn}   disabled>자산 이동</button>
            <button className={styles.returnBtn} disabled>반납</button>
          </div>

          {isLoading && (
            <div className={styles.stateMsg}>데이터를 불러오는 중...</div>
          )}

          {isError && (
            <div className={`${styles.stateMsg} ${styles.errorMsg}`}>
              데이터 조회에 실패했습니다.
            </div>
          )}

          {!isLoading && !isError && (
            <>
              <DataTable
                columns={DF_COLUMNS}
                rows={paginatedRows}
                statusMap={DF_STATUS_MAP}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                totalCount={totalCount}
              />

              {/* ── 페이지네이션 ────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={safePage === 1}
                    onClick={() => handlePageChange(safePage - 1)}
                    aria-label="이전 페이지"
                  >
                    ‹
                  </button>

                  {pageNumbers[0] > 1 && (
                    <>
                      <button className={styles.pageBtn} onClick={() => handlePageChange(1)}>1</button>
                      {pageNumbers[0] > 2 && <span className={styles.pageDots}>…</span>}
                    </>
                  )}

                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      className={`${styles.pageBtn} ${safePage === p ? styles.pageBtnActive : ''}`}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </button>
                  ))}

                  {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                        <span className={styles.pageDots}>…</span>
                      )}
                      <button className={styles.pageBtn} onClick={() => handlePageChange(totalPages)}>
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    className={styles.pageBtn}
                    disabled={safePage === totalPages}
                    onClick={() => handlePageChange(safePage + 1)}
                    aria-label="다음 페이지"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>
    </div>
  )
}

export default UserDfAssetsPage