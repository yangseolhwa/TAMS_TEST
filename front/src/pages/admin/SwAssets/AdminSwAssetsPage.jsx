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
import styles from './AdminSwAssetsPage.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const SW_STATUS_MAP = {
  in_use:    { label: '사용중',   color: 'green' },
  available: { label: '사용가능', color: 'blue'  },
  returned:  { label: '반납됨',   color: 'gray'  },
}

// 멀티라인 렌더링 헬퍼
const renderMultiLine = (values, className) => {
  const filtered = values.filter(Boolean)
  if (filtered.length === 0) return null
  return (
    <div className={className}>
      {filtered.map((v, i) => <span key={i}>{v}</span>)}
    </div>
  )
}

// shared / other 라이선스 분류 헬퍼
const splitLicenses = (licenses) => ({
  sharedLicenses: licenses.filter((l) => l.license_type === 'shared'),
  otherLicenses:  licenses.filter((l) => l.license_type !== 'shared'),
})

const COLUMNS = [
  { key: 'no',          label: 'No'     },
  { key: 'productName', label: '제품명' },
  { key: 'version',     label: '버전'   },
  {
    key: 'licenseKeys',
    label: '라이선스',
    renderCell: (row) => {
      const { sharedLicenses, otherLicenses } = splitLicenses(row.licenses)

      // shared: 키 1개만 표시
      const keys = [
        ...(sharedLicenses.length > 0
          ? [sharedLicenses[0].license_key, sharedLicenses[0].license_password].filter(Boolean)
          : []),
        ...otherLicenses.flatMap((l) => [l.license_key, l.license_password].filter(Boolean)),
      ]
      return renderMultiLine(keys, styles.multiLine)
    },
  },
  { key: 'relatedLink', label: '관련 링크' },
  { key: 'manufacturer', label: '제조사'  },
  {
    key: 'users',
    label: '사용자',
    renderCell: (row) => {
      const { sharedLicenses, otherLicenses } = splitLicenses(row.licenses)
        
      // shared: 사용자 여러 명 multiLine / 나머지: 각 라이선스별 1명
      const users = [
        ...sharedLicenses.map((l) => l.user?.name ?? l.user?.email),
        ...otherLicenses.map((l) => l.user?.name ?? l.user?.email),
      ]
      return renderMultiLine(users, styles.multiLine)
    },
  },
  { key: 'usedCount',   label: '사용수량' },
  { key: 'remainCount', label: '남은수량' },
  { key: 'remarks',     label: '비고'     },
  { key: 'state',       label: '상태',    type: 'status' },
]

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

  const rawList = data?.list ?? []

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
      relatedLink:  sw.related_link ?? null,
      remarks:      sw.remarks      ?? null,
      state:        sw.state,
      licenses:     sw.licenses     ?? [],
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
            columns={COLUMNS}
            rows={isLoading ? [] : rows}
            statusMap={SW_STATUS_MAP}
            selectable={false}
            totalCount={rows.length}
            highlight={appliedFilters.keyword}
            maxHeight="calc(100vh - 450px)"
          />
        </Card>
      </section>
    </div>
  )
}

export default AdminSwAssetsPage
