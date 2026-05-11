import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import PageHeader from '../../../components/PageHeader/PageHeader'
import Card from '../../../components/Card/Card'
import DataTable from '../../../components/DataTable/DataTable'
import ActionButton from '../../../components/ActionButton/ActionButton'
import { fetchPersonalHistory } from '../../../services/assetService'
import styles from './AdminAssetHistoryPage.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const CHANGE_TYPE_STATUS_MAP = {
  '등록':     { label: '등록',     color: 'green'  },
  '반납':     { label: '반납',     color: 'return' },
  '상태 변경': { label: '상태 변경', color: 'yellow' },
  '이동':     { label: '이동',     color: 'blue'   },
  '할당':     { label: '할당',     color: 'purple' },
}

const STATE_STATUS_MAP = {
  in_use:    { label: '사용중',   color: 'green'  },
  stored:    { label: '보관중',   color: 'blue'   },
  returned:  { label: '반납됨',   color: 'return' },
  available: { label: '사용가능', color: 'gray'   },
}

const renderValueCell = (value) => {
  if (value == null || value === '') return <span className={styles.dash}>-</span>
  const mapped = STATE_STATUS_MAP[value]
  if (!mapped) return <span>{value}</span>
  return (
    <span className={`${styles.badge} ${styles[`status_${mapped.color}`]}`}>
      {mapped.label}
    </span>
  )
}

const COLUMNS = [
  { key: 'no',          label: 'No' },
  { key: 'requestedAt', label: '날짜' },
  { key: 'changeType',  label: '변경', type: 'status' },
  {
    key: 'beforeValue',
    label: '변경 전',
    renderCell: (row) => renderValueCell(row.beforeValue),
  },
  {
    key: 'afterValue',
    label: '변경 후',
    renderCell: (row) => renderValueCell(row.afterValue),
  },
  { key: 'assetName', label: '자산명',  renderCell: (row) => row.assetName ?? <span className={styles.dash}>-</span> },
  { key: 'detail',    label: '상세',    renderCell: (row) => row.detail    ?? <span className={styles.dash}>-</span> },
  { key: 'user',      label: '처리자',  renderCell: (row) => row.user      ?? <span className={styles.dash}>-</span> },
]

const EMPTY_FILTER = {
  type:    '',
  from:    '',
  to:      '',
  keyword: '',
}
// ─────────────────────────────────────────────────────────────────────────────

const AdminAssetHistoryPage = () => {
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)
  const [appliedKeyword, setAppliedKeyword] = useState('')

  // API 파라미터 (keyword 제외)
  const apiParams = useMemo(() => {
    const p = {}
    if (appliedFilters.type) p.type = appliedFilters.type
    if (appliedFilters.from) p.from = appliedFilters.from
    if (appliedFilters.to)   p.to   = appliedFilters.to
    return p
  }, [appliedFilters])

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['personalHistory', apiParams],
    queryFn:  () => fetchPersonalHistory(apiParams),
    refetchOnWindowFocus: false,
  })

  // 클라이언트 키워드 필터
  const filteredRows = useMemo(() => {
    if (!appliedKeyword) return rows
    const kw = appliedKeyword.toLowerCase()
    return rows.filter((row) => {
      const target = [row.assetName, row.detail, row.user, row.beforeValue, row.afterValue]
        .filter(Boolean).join(' ').toLowerCase()
      return target.includes(kw)
    }).map((row, i) => ({ ...row, no: i + 1 }))
  }, [rows, appliedKeyword])

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
    <div className={styles.page}>
      <PageHeader
        title="내 자산 히스토리"
        desc="반납, 등록, 위치 이동에 관한 모든 이력을 조회합니다."
      />

      <section className={styles.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={styles.filterArea}>
            <select
              className={styles.filterSelect}
              value={filterForm.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="">자산 유형 전체</option>
              <option value="enterprise">PC</option>
              <option value="sw">SW</option>
            </select>

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

            <div className={styles.filterSearchWrap}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="자산명 / 처리자 검색"
                value={filterForm.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className={styles.filterSearchBtn} onClick={handleSearch}>
                <Search size={14} />
              </button>
            </div>
          </div>

          <DataTable
            columns={COLUMNS}
            rows={isLoading ? [] : filteredRows}
            statusMap={CHANGE_TYPE_STATUS_MAP}
            selectable={false}
            totalCount={filteredRows.length}
            highlight={appliedKeyword}
            maxHeight="calc(100vh - 450px)"
          />
        </Card>
      </section>
    </div>
  )
}

export default AdminAssetHistoryPage
