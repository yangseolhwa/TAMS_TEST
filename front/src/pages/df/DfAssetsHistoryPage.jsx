import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import PageHeader from '../../components/PageHeader/PageHeader'
import Card from '../../components/Card/Card'
import DataTable from '../../components/DataTable/DataTable'
import ActionButton from '../../components/ActionButton/ActionButton'
import { fetchDfDashboard, fetchDfHistory } from '../../services/assetService'
import common from '../AssetPage.common.module.css'
import styles from './DfAssetsHistoryPage.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const REQUEST_TYPE_STYLE = {
  '등록':     styles.badgeRegister,
  '반납':     styles.badgeReturn,
  '상태 변경': styles.badgeStateChange,
  '이동':     styles.badgeMove,
}

const STATE_BADGE_STYLE = {
  '사용중': styles.stateActive,
  '보관중': styles.stateStored,
  '대여중': styles.stateInactive,
}

const renderChangedCell = (requestType, locationVal, stateVal) => {
  if (requestType === '이동') {
    return locationVal
      ? <span>{locationVal}</span>
      : <span className={styles.dash}>-</span>
  }
  if (requestType === '상태 변경') {
    return stateVal
      ? <span className={`${styles.badge} ${STATE_BADGE_STYLE[stateVal] ?? ''}`}>{stateVal}</span>
      : <span className={styles.dash}>-</span>
  }
  return <span className={styles.dash}>-</span>
}

const COLUMNS = [
  { key: 'no',          label: 'No' },
  { key: 'projectName',  label: '프로젝트',  renderCell: (row) => row.projectName  ?? <span className={styles.dash}>-</span> },
  { key: 'category',     label: '자산 종류',  renderCell: (row) => row.category     ?? <span className={styles.dash}>-</span> },
  { key: 'modelName',    label: '모델명',     renderCell: (row) => row.modelName    ?? <span className={styles.dash}>-</span> },
  { key: 'serialNumber', label: '시리얼',     renderCell: (row) => row.serialNumber ?? <span className={styles.dash}>-</span> },
  {
    key: 'requestType',
    label: '요청',
    renderCell: (row) => (
      <span className={`${styles.badge} ${REQUEST_TYPE_STYLE[row.requestType] ?? ''}`}>
        {row.requestType}
      </span>
    ),
  },
  {
    key: 'prevChange',
    label: '변경 전',
    renderCell: (row) => renderChangedCell(row.requestType, row.prevLocation, row.prevState),
  },
  {
    key: 'nextChange',
    label: '변경 후',
    renderCell: (row) => renderChangedCell(row.requestType, row.nextLocation, row.nextState),
  },
  { key: 'requestedAt', label: '날짜' },
]

const EMPTY_FILTER = {
  project_id:    '',
  asset_type_id: '',
  from:          '',
  to:            '',
  keyword:       '',
}
// ─────────────────────────────────────────────────────────────────────────────

const DfAssetsHistoryPage = ({ role }) => {
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)
  const [appliedKeyword, setAppliedKeyword] = useState('')

  // ── 옵션 (대시보드 캐시 재사용) ───────────────────────────────────────────
  const { data: dashboard } = useQuery({
    queryKey: ['dfDashboard'],
    queryFn:  fetchDfDashboard,
    refetchOnWindowFocus: false,
  })
  const projectOptions = dashboard?.projectOptions ?? []
  const typeOptions    = dashboard?.typeOptions    ?? []

  // ── 히스토리 조회 ─────────────────────────────────────────────────────────
  // keyword는 프론트 클라이언트 필터링 (API 파라미터 없음)
  const apiParams = useMemo(() => {
    const { keyword: _k, ...rest } = appliedFilters
    return rest
  }, [appliedFilters])

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['dfHistory', apiParams],
    queryFn:  () => fetchDfHistory(apiParams),
    refetchOnWindowFocus: false,
  })

  // ── 클라이언트 키워드 필터 ────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!appliedKeyword) return rows
    const kw = appliedKeyword.toLowerCase()
    return rows.filter((row) => {
      const target = [
        row.projectName, row.category,
        row.modelName, row.serialNumber,
        row.prevLocation, row.nextLocation,
      ].filter(Boolean).join(' ').toLowerCase()
      return target.includes(kw)
    }).map((row, i) => ({ ...row, no: i + 1 }))
  }, [rows, appliedKeyword])

  // ── 필터 핸들러 ───────────────────────────────────────────────────────────
  const handleFilterChange = (key, value) =>
    setFilterForm((prev) => ({ ...prev, [key]: value }))

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
    setAppliedKeyword('')
  }

  const handleSearch = () => {
    setAppliedFilters(filterForm)
    setAppliedKeyword(filterForm.keyword)
  }

  return (
    <div className={common.page}>
      <PageHeader
        title="DF 자산 히스토리"
        desc="자산 이동, 상태 변경, 반납, 등록에 관한 모든 이력을 조회합니다."
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.project_id}
              onChange={(e) => handleFilterChange('project_id', e.target.value)}
            >
              <option value="">전체 프로젝트</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.asset_type_id}
              onChange={(e) => handleFilterChange('asset_type_id', e.target.value)}
            >
              <option value="">자산 종류 전체</option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* 날짜 범위 */}
            <input
              type="date"
              className={styles.filterDate}
              value={filterForm.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
            />
            <span className={styles.dateSeparator}>~</span>
            <input
              type="date"
              className={styles.filterDate}
              value={filterForm.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
            />

            <ActionButton variant="white" size="sm" label="초기화" onClick={handleFilterReset} />

            <div className={common.filterSearchWrap}>
              <input
                type="text"
                className={common.filterInput}
                placeholder="모델명 / 시리얼 / 위치 검색"
                value={filterForm.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className={common.filterSearchBtn} onClick={handleSearch}>
                <Search size={14} />
              </button>
            </div>
          </div>

          {/* 총 건수 */}
          <DataTable
            columns={COLUMNS}
            rows={isLoading ? [] : filteredRows}
            selectable={false}
            totalCount={filteredRows.length}
            highlight={appliedKeyword}
          />
        </Card>
      </section>
    </div>
  )
}

export default DfAssetsHistoryPage
