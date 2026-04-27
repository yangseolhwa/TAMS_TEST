import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import Card from '../../../components/Card/Card'
import DataTable from '../../../components/DataTable/DataTable'
import PageHeader from '../../../components/PageHeader/PageHeader'
import ActionButton from '../../../components/ActionButton/ActionButton'
import BackButton from '../../../components/BackButton/BackButton'
import { fetchSwList } from '../../../services/assetService'
import common from '../../AssetPage.common.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const SW_COLUMNS = [
  { key: 'no',           label: 'No' },
  { key: 'productName',  label: '제품명',   type: 'dash' },
  { key: 'version',      label: '버전',     type: 'dash' },
  { key: 'manufacturer', label: '제조사',   type: 'dash' },
  { key: 'usedCount',    label: '사용수량', type: 'dash' },
  { key: 'remainCount',  label: '남은수량', type: 'dash' },
  { key: 'state',        label: '상태',     type: 'status' },
]

const SW_STATUS_MAP = {
  in_use:    { label: '사용중',   color: 'green' },
  available: { label: '사용가능', color: 'blue'  },
  returned:  { label: '반납됨',   color: 'gray'  },
}

const EMPTY_FILTER = { name: '', manufacturer: '', keyword: '' }
// ─────────────────────────────────────────────────────────────────────────────

const AdminSwAssetsPage = () => {
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)

  const { data, isLoading } = useQuery({
    queryKey: ['swList', appliedFilters],
    queryFn:  () => fetchSwList({
      ...(appliedFilters.name.trim()         && { name:         appliedFilters.name.trim() }),
      ...(appliedFilters.manufacturer.trim() && { manufacturer: appliedFilters.manufacturer.trim() }),
    }),
    refetchOnWindowFocus: false,
  })

  // SW 목록 → DataTable rows 변환
  // API: { id, name, version, manufacturer, quantity, in_use_count, available_count, state }
  const rawList = data?.list ?? []

  // 클라이언트 키워드 필터 후 행 변환
  const rows = rawList
    .filter((sw) => {
      if (!appliedFilters.keyword) return true
      const kw = appliedFilters.keyword.toLowerCase()
      return (
        sw.name?.toLowerCase().includes(kw) ||
        sw.manufacturer?.toLowerCase().includes(kw) ||
        sw.version?.toLowerCase().includes(kw)
      )
    })
    .map((sw, i) => ({
      id:           sw.id,
      no:           i + 1,
      productName:  sw.name         ?? null,
      version:      sw.version      ?? null,
      manufacturer: sw.manufacturer ?? null,
      usedCount:    sw.in_use_count    ?? 0,
      remainCount:  sw.available_count ?? 0,
      state:        sw.state,
    }))

  const handleFilterChange = (key, value) =>
    setFilterForm((prev) => ({ ...prev, [key]: value }))

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
  }

  const handleSearch = () => setAppliedFilters(filterForm)

  return (
    <div className={common.page}>
      <PageHeader
        title="SW 전체 조회"
        desc={<BackButton label="내 자산 관리" to="/admin/my-assets" />}
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
            >
              <option value="">제품명 전체</option>
              {rawList.map((sw) => (
                <option key={sw.id} value={sw.name}>{sw.name}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.manufacturer}
              onChange={(e) => handleFilterChange('manufacturer', e.target.value)}
            >
              <option value="">제조사 전체</option>
              {[...new Set(rawList.map((sw) => sw.manufacturer).filter(Boolean))].map((mfr) => (
                <option key={mfr} value={mfr}>{mfr}</option>
              ))}
            </select>

            <ActionButton
              variant="white"
              size="sm"
              label="초기화"
              onClick={handleFilterReset}
            />

            <div className={common.filterSearchWrap}>
              <input
                type="text"
                className={common.filterInput}
                placeholder="검색어를 입력하세요"
                value={filterForm.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className={common.filterSearchBtn} onClick={handleSearch}>
                <Search size={14} />
              </button>
            </div>
          </div>

          <DataTable
            columns={SW_COLUMNS}
            rows={isLoading ? [] : rows}
            statusMap={SW_STATUS_MAP}
            selectable={false}
            selectedIds={[]}
            onSelectionChange={() => {}}
            totalCount={rows.length}
            highlight={appliedFilters.keyword}
          />
        </Card>
      </section>
    </div>
  )
}

export default AdminSwAssetsPage