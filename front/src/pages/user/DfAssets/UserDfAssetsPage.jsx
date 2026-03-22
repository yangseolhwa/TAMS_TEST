import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import PageHeader from '../../../components/PageHeader/PageHeader'
import Card from '../../../components/Card/Card'
import DataTable from '../../../components/DataTable/DataTable'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal'
import { fetchDfAssets, returnDfAssets } from '../../../services/assetService'
import styles from './UserDfAssetsPage.module.css'

// ─── 상수 ─────────────────────────────────────────────────────────────────────
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

const DF_STATUS_MAP = {
  active: { label: '사용중',   color: 'green'  },
  stored: { label: '보관중',   color: 'blue'   },
  rented: { label: '외부대여', color: 'yellow' },
}

const STATE_OPTIONS = [
  { value: 'active', label: '사용중'   },
  { value: 'stored', label: '보관중'   },
  { value: 'rented', label: '외부대여' },
]

const PAGE_SIZE = 10

const EMPTY_FILTER = {
  projectId:    '',
  itemTypeId:   '',
  manufacturer: '',
  state:        '',
  keyword:      '',
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
const UserDfAssetsPage = () => {
  const queryClient = useQueryClient()

  // ── 조회 필터 상태 ────────────────────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState([])
  const [currentPage,    setCurrentPage]    = useState(1)
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)

  // ── 반납 관련 상태 ────────────────────────────────────────────────────────
  const [returnMode,        setReturnMode]        = useState(false)  // 비고란 활성화 여부
  const [returnRemarks,     setReturnRemarks]     = useState('')
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [showNoSelectModal, setShowNoSelectModal] = useState(false)

  // ── Base query ────────────────────────────────────────────────────────────
  const { data: baseData } = useQuery({
    queryKey: ['dfAssets', 'base'],
    queryFn:  () => fetchDfAssets(),
    staleTime: Infinity,
  })

  // ── Filtered query ────────────────────────────────────────────────────────
  const { data: filteredData, isLoading, isError } = useQuery({
    queryKey: ['dfAssets', 'filtered', appliedFilters],
    queryFn: () => {
      const params = {}
      if (appliedFilters.projectId)    params.project_id   = appliedFilters.projectId
      if (appliedFilters.itemTypeId)   params.item_type_id = appliedFilters.itemTypeId
      if (appliedFilters.manufacturer) params.manufacturer = appliedFilters.manufacturer
      if (appliedFilters.state)        params.state        = appliedFilters.state
      if (appliedFilters.keyword)      params.keyword      = appliedFilters.keyword
      return fetchDfAssets(params)
    },
  })

  const allRows          = filteredData?.rows             ?? []
  const projectSummaries = (baseData ?? filteredData)?.projectSummaries ?? []

  // ── 드롭다운 옵션 ─────────────────────────────────────────────────────────
  const itemTypeOptions = useMemo(() => {
    const seen = new Map()
    ;(baseData?.rows ?? []).forEach((r) => {
      if (r.itemTypeId && !seen.has(r.itemTypeId)) seen.set(r.itemTypeId, r.itemType)
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [baseData])

  const manufacturerOptions = useMemo(() => {
    const set = new Set((baseData?.rows ?? []).map((r) => r.manufacturer).filter(Boolean))
    return Array.from(set)
  }, [baseData])

  // ── 반납 Mutation ─────────────────────────────────────────────────────────
  const returnMutation = useMutation({
    mutationFn: returnDfAssets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      toast.success('반납이 완료되었습니다.')
      cancelReturnMode()
    },
    onError: (err) => {
      toast.error(err.message)
      setShowReturnConfirm(false)
    },
  })

  // ── 반납 핸들러 ───────────────────────────────────────────────────────────
  // 1단계: 반납 버튼 클릭
  const handleReturnClick = () => {
    if (selectedIds.length === 0) {
      setShowNoSelectModal(true)
      return
    }
    setReturnMode(true)     // 비고란 활성화
  }

  // 2단계: 반납 확인 버튼 클릭 → 모달 오픈
  const handleReturnConfirmClick = () => {
    setShowReturnConfirm(true)
  }

  // 3단계: 모달 확인 → API 호출
  const handleReturnConfirm = () => {
    returnMutation.mutate({ item_ids: selectedIds })
    setShowReturnConfirm(false)
  }

  // 반납 모드 취소
  const cancelReturnMode = () => {
    setReturnMode(false)
    setReturnRemarks('')
    setSelectedIds([])
    setShowReturnConfirm(false)
  }

  // ── 필터 핸들러 ───────────────────────────────────────────────────────────
  const handleFilterChange = (field, value) => {
    setFilterForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSearch = () => {
    setAppliedFilters({ ...filterForm })
    setCurrentPage(1)
    setSelectedIds([])
  }

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
    setCurrentPage(1)
    setSelectedIds([])
  }

  const handleCardClick = (projectId) => {
    const next = { ...EMPTY_FILTER, projectId: String(projectId) }
    setFilterForm(next)
    setAppliedFilters(next)
    setCurrentPage(1)
    setSelectedIds([])
  }

  const handleCardAllClick = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
    setCurrentPage(1)
    setSelectedIds([])
  }

  // ── 페이지네이션 ──────────────────────────────────────────────────────────
  const totalCount = allRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage   = Math.min(currentPage, totalPages)

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return allRows.slice(start, start + PAGE_SIZE)
  }, [allRows, safePage])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    setSelectedIds([])
  }

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

  // ─────────────────────────────────────────────────────────────────────────
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

        {/* 프로젝트 요약 카드 */}
        <div className={styles.projCards}>
          <div
            className={`${styles.projCard} ${styles.projCardTotal} ${
              appliedFilters.projectId === '' ? styles.projCardActive : ''
            }`}
            onClick={handleCardAllClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleCardAllClick()}
          >
            <div className={styles.projCardTitle}>전체 프로젝트</div>
            <div className={styles.projCardCount}>
              {isLoading ? '—' : (baseData ?? filteredData)?.rows?.length ?? 0}
              <span className={styles.projCardUnit}> 건</span>
            </div>
          </div>

          {projectSummaries.map((proj) => (
            <div
              key={proj.id}
              className={`${styles.projCard} ${
                appliedFilters.projectId === String(proj.id) ? styles.projCardActive : ''
              }`}
              onClick={() => handleCardClick(proj.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleCardClick(proj.id)}
            >
              <div className={styles.projCardTitle}>{proj.name}</div>
              <div className={styles.projCardCount}>
                {proj.count}
                <span className={styles.projCardUnit}> 건</span>
              </div>
            </div>
          ))}
        </div>

        {/* 자산 테이블 카드 */}
        <Card>
          {/* 필터 영역 */}
          <div className={styles.filterArea}>
            <select
              className={styles.filterSelect}
              value={filterForm.projectId}
              onChange={(e) => handleFilterChange('projectId', e.target.value)}
            >
              <option value="">전체 프로젝트</option>
              {projectSummaries.map((proj) => (
                <option key={proj.id} value={proj.id}>{proj.name}</option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filterForm.itemTypeId}
              onChange={(e) => handleFilterChange('itemTypeId', e.target.value)}
            >
              <option value="">자산 종류 전체</option>
              {itemTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filterForm.manufacturer}
              onChange={(e) => handleFilterChange('manufacturer', e.target.value)}
            >
              <option value="">제조사 전체</option>
              {manufacturerOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filterForm.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
            >
              <option value="">자산 상태 전체</option>
              {STATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <button className={styles.filterResetBtn} onClick={handleFilterReset}>
              초기화
            </button>

            <div className={styles.filterSearchWrap}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="검색어를 입력하세요"
                value={filterForm.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className={styles.filterSearchBtn} onClick={handleSearch}>
                <Search size={14} />
              </button>
            </div>
          </div>

          {/* 비고란 — 반납 모드에서만 표시 */}
          {returnMode && (
            <div className={styles.returnRemarkArea}>
              <label className={styles.returnRemarkLabel}>비고</label>
              <input
                className={styles.returnRemarkInput}
                type="text"
                placeholder="반납 사유 또는 메모를 입력하세요 (선택)"
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
              />
            </div>
          )}

          {/* 액션 버튼 영역 */}
          <div className={styles.tableActions}>
            {/* 자산 이동 — MAIN04에서 구현 예정 */}
            <button className={styles.moveBtn} disabled>자산 이동</button>

            {returnMode ? (
              <>
                <button
                  className={styles.returnCancelBtn}
                  onClick={cancelReturnMode}
                >
                  취소
                </button>
                <button
                  className={styles.returnConfirmBtn}
                  onClick={handleReturnConfirmClick}
                  disabled={returnMutation.isPending}
                >
                  반납 확인
                </button>
              </>
            ) : (
              <button className={styles.returnBtn} onClick={handleReturnClick}>
                반납
              </button>
            )}
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
                highlight={appliedFilters.keyword}
              />

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={safePage === 1}
                    onClick={() => handlePageChange(safePage - 1)}
                    aria-label="이전 페이지"
                  >‹</button>

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
                    >{p}</button>
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
                  >›</button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      {/* ── 모달 ── */}
      <ConfirmModal
        isOpen={showNoSelectModal}
        title="자산을 선택해주세요."
        desc="반납할 자산을 먼저 선택해주세요."
        confirmLabel="확인"
        confirmVariant="primary"
        onConfirm={() => setShowNoSelectModal(false)}
        onCancel={() => setShowNoSelectModal(false)}
      />

      <ConfirmModal
        isOpen={showReturnConfirm}
        title={`선택한 자산 ${selectedIds.length}개를 반납할까요?`}
        desc="반납된 자산은 목록에서 제외됩니다."
        confirmLabel="반납"
        confirmVariant="danger"
        onConfirm={handleReturnConfirm}
        onCancel={() => setShowReturnConfirm(false)}
      />
    </div>
  )
}

export default UserDfAssetsPage