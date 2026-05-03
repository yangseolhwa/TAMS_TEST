import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import Card from '../../../components/Card/Card'
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

  // 멀티라인 셀 렌더링
  const renderMultiLine = (values) => {
    const filtered = values.filter(Boolean)
    if (filtered.length === 0) return <span className={styles.dash}>—</span>
    return (
      <div className={styles.multiLine}>
        {filtered.map((v, i) => <span key={i}>{v}</span>)}
      </div>
    )
  }

  // 상태 뱃지
  const renderStatus = (state) => {
    const s = SW_STATUS_MAP[state]
    if (!s) return <span className={styles.dash}>—</span>
    return (
      <span className={`${styles.badge} ${styles[`status_${s.color}`]}`}>
        {s.label}
      </span>
    )
  }

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

          {/* 테이블 */}
          <div className={styles.tableWrapper}>

            {/* 헤더 */}
            <div className={styles.thead}>
              <div className={styles.th}>No</div>
              <div className={styles.th}>제품명</div>
              <div className={styles.th}>버전</div>
              <div className={styles.th}>라이선스</div>
              <div className={styles.th}>관련 링크</div>
              <div className={styles.th}>제조사</div>
              <div className={styles.th}>사용자</div>
              <div className={styles.th}>사용수량</div>
              <div className={styles.th}>남은수량</div>
              <div className={styles.th}>비고</div>
              <div className={styles.th}>상태</div>
            </div>

            {/* 바디 */}
            <div className={styles.tbody}>
              {isLoading ? (
                <div className={styles.empty}>불러오는 중...</div>
              ) : rows.length === 0 ? (
                <div className={styles.empty}>데이터가 없습니다.</div>
              ) : rows.map((row) => (
                <div key={row.id} className={styles.tr}>
                  <div className={styles.td}>{row.no}</div>
                  <div className={styles.td}>{row.productName ?? <span className={styles.dash}>—</span>}</div>
                  <div className={styles.td}>{row.version ?? <span className={styles.dash}>—</span>}</div>
                  <div className={styles.td}>
                    {renderMultiLine(row.licenses.flatMap((l) => [l.license_key, l.license_password].filter(Boolean)))}
                  </div>
                  <div className={styles.td}>{row.relatedLink ?? <span className={styles.dash}>—</span>}</div>
                  <div className={styles.td}>{row.manufacturer ?? <span className={styles.dash}>—</span>}</div>
                  <div className={styles.td}>
                    {renderMultiLine(row.licenses.map((l) => l.user?.name ?? l.user?.email))}
                  </div>
                  <div className={styles.td}>{row.usedCount}</div>
                  <div className={styles.td}>{row.remainCount}</div>
                  <div className={styles.td}>
                    {renderMultiLine(row.remarks ? row.remarks.split(/[\,]/).map((v) => v.trim()) : [])}
                    </div>
                  <div className={styles.td}>{renderStatus(row.state)}</div>
                </div>
              ))}
            </div>

          </div>

          <p className={styles.totalCount}>총 {rows.length}건</p>
        </Card>
      </section>
    </div>
  )
}

export default AdminSwAssetsPage
