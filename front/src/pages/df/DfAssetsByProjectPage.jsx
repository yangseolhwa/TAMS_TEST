import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Download } from 'react-bootstrap-icons'
import Card from '../../components/Card/Card'
import DataTable from '../../components/DataTable/DataTable'
import PageHeader from '../../components/PageHeader/PageHeader'
import ActionButton from '../../components/ActionButton/ActionButton'
import BackButton from '../../components/BackButton/BackButton'
import common from '../AssetPage.common.module.css'
import styles from './DfAssetsByProjectPage.module.css'

// ── 컬럼 정의 ────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'no',            label: 'No'       },
  { key: 'ownerOrg',      label: '소유 기관',  type: 'dash' },
  { key: 'equipmentNo',   label: '장비 번호',  type: 'dash' },
  { key: 'majorCategory', label: '자산 대분류', type: 'dash' },
  { key: 'minorCategory', label: '자산 중분류', type: 'dash' },
  { key: 'modelName',     label: '모델명',     type: 'dash' },
  { key: 'spec',          label: '규격',       type: 'dash' },
  { key: 'manufacturer',  label: '제조사',     type: 'dash' },
  { key: 'serialNumber',  label: '시리얼 번호', type: 'dash' },
  { key: 'acquiredAt',    label: '취득일',     type: 'dash' },
  { key: 'returnedAt',    label: '반납일',     type: 'dash' },
  { key: 'location',      label: '위치',       type: 'dash' },
  { key: 'remarks',       label: '비고',       type: 'dash' },
  { key: 'state',         label: '상태',       type: 'status' },
]

const STATUS_MAP = {
  active:   { label: '사용중',  color: 'green'  },
  inactive: { label: '미사용', color: 'gray'   },
  stored:   { label: '보관중', color: 'blue'   },
  returned: { label: '반납됨', color: 'yellow' },
}

// ── 임시 목업 옵션 (API 연동 시 대체 예정) ──────────────────────────────────
const MOCK_OWNER_ORG_OPTIONS      = ['본사', '서울지사', '부산지사']
const MOCK_MAJOR_CATEGORY_OPTIONS = ['서버/네트워크', 'PC/모바일', '주변기기']
const MOCK_MINOR_CATEGORY_OPTIONS = ['노트북', '데스크탑', '모니터', '서버', '스위치', '태블릿']
const MOCK_MFR_OPTIONS            = ['Samsung', 'LG', 'Dell', 'Apple']
const MOCK_LOCATION_OPTIONS       = ['서울 본사 1층', '서울 본사 2층', '부산 사무소']

const EMPTY_FILTER = {
  manufacturer:  '',
  ownerOrg:      '',
  majorCategory: '',
  minorCategory: '',
  location:      '',
  state:         '',
  keyword:       '',
}
// ─────────────────────────────────────────────────────────────────────────────

const DfAssetsByProjectPage = ({ role }) => {
  const { state } = useLocation()
  const projectId = state?.projectId

  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)
  const [selectedIds,    setSelectedIds]    = useState([])

  // null | 'stateChange' | 'move' | 'return'
  const [activeMode, setActiveMode] = useState(null)

  const handleFilterChange = (key, value) => {
    setFilterForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
  }

  const handleSearch = () => {
    setAppliedFilters(filterForm)
  }

  const handleModeEnter = (mode) => {
    setSelectedIds([])
    setActiveMode(mode)
  }

  const handleModeCancel = () => {
    setSelectedIds([])
    setActiveMode(null)
  }

  // API 연동 시 기능 추가 예정
  const handleModeConfirm = () => {
    setSelectedIds([])
    setActiveMode(null)
  }

  return (
    <div className={common.page}>
      <PageHeader
        title="프로젝트별 자산 조회"
        desc={<BackButton label="DF 자산 현황" to={`/${role}/df-assets/dashboard`} />}
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.ownerOrg}
              onChange={(e) => handleFilterChange('ownerOrg', e.target.value)}
            >
              <option value="">소유 기관 전체</option>
              {MOCK_OWNER_ORG_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.majorCategory}
              onChange={(e) => handleFilterChange('majorCategory', e.target.value)}
            >
              <option value="">자산 대분류 전체</option>
              {MOCK_MAJOR_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.minorCategory}
              onChange={(e) => handleFilterChange('minorCategory', e.target.value)}
            >
              <option value="">자산 중분류 전체</option>
              {MOCK_MINOR_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.manufacturer}
              onChange={(e) => handleFilterChange('manufacturer', e.target.value)}
            >
              <option value="">제조사 전체</option>
              {MOCK_MFR_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
            >
              <option value="">위치 전체</option>
              {MOCK_LOCATION_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
            >
              <option value="">자산 상태 전체</option>
              {Object.entries(STATUS_MAP).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <ActionButton variant="white" size="sm" label="초기화" onClick={handleFilterReset} />

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

          {/* 액션 버튼 영역 */}
          <div className={styles.tableActions}>
            {/* 엑셀 다운로드 버튼은 항상 왼쪽 고정 */}
            <button type="button" className={styles.exportBtn} onClick={() => {}}>
              <Download size={13} />
              엑셀 다운로드
            </button>

            <div className={styles.actionButtons}>
              {activeMode === null ? (
              <>
                <ActionButton variant="black" size="sm" label="상태 변경" onClick={() => handleModeEnter('stateChange')} />
                <ActionButton variant="blue"  size="sm" label="자산 이동" onClick={() => handleModeEnter('move')} />
                <ActionButton variant="red"   size="sm" label="반납"      onClick={() => handleModeEnter('return')} />
              </>
            ) : (
              <>
                <ActionButton variant="white" size="sm" label="취소" onClick={handleModeCancel} />
                {activeMode === 'stateChange' && <ActionButton variant="black" size="sm" label="저장" onClick={handleModeConfirm} />}
                {activeMode === 'move'        && <ActionButton variant="blue"  size="sm" label="저장" onClick={handleModeConfirm} />}
                {activeMode === 'return'      && <ActionButton variant="red"   size="sm" label="확인" onClick={handleModeConfirm} />}
              </>
            )}
            </div>

          </div>

          <DataTable
            columns={COLUMNS}
            rows={[]}
            statusMap={STATUS_MAP}
            selectable={activeMode !== null}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalCount={0}
            highlight={appliedFilters.keyword}
          />
        </Card>
      </section>
    </div>
  )
}

export default DfAssetsByProjectPage
