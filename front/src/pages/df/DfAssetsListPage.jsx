import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Download } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import Card from '../../components/Card/Card'
import DataTable from '../../components/DataTable/DataTable'
import PageHeader from '../../components/PageHeader/PageHeader'
import ActionButton from '../../components/ActionButton/ActionButton'
import BackButton from '../../components/BackButton/BackButton'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import { matchesAnyField } from '../../utils/koreanSearch'
import {
  fetchDfDashboard,
  fetchDfItemTypes,
  fetchDfAssets,
  changeDfAssetState,
  moveDfAssets,
  returnDfAssets,
  exportDfAssets,
} from '../../services/assetService'
import common from '../AssetPage.common.module.css'
import styles from './DfAssetsListPage.module.css'

// ── 컬럼 정의 ────────────────────────────────────────────────────────────────
// 전체 조회: No, 프로젝트명, 분류, 소유 기관, 장비 번호,
//            제조사, 시리얼 번호, 위치, 대여일, 반납일, 비고
const COLUMNS = [
  { key: 'no',          label: 'No',       width: '48px' },
  { key: 'projectName', label: '프로젝트명', type: 'dash' },
  {
    key: 'categoryLabel',
    label: '분류',
    renderCell: (row) => {
      const parent = row.parentCategoryName
      const sub    = row.subCategoryName
      if (!parent) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
      if (!sub)    return <span>{parent}</span>
      return <span>{parent} - {sub}</span>
    },
  },
  { key: 'ownerOrg',     label: '소유 기관',   type: 'dash' },
  { key: 'equipmentNo',  label: '장비 번호',   type: 'dash' },
  { key: 'manufacturer', label: '제조사',      type: 'dash' },
  { key: 'serialNumber', label: '시리얼 번호', type: 'dash' },
  { key: 'location',     label: '위치',        type: 'dash' },
  { key: 'acquiredAt',   label: '대여일',      type: 'dash' },
  { key: 'returnedAt',   label: '반납일',      type: 'dash' },
  { key: 'state',        label: '상태',        type: 'status' },
]

const STATUS_MAP = {
  in_use:   { label: '사용중', color: 'green'  },
  stored:   { label: '보관중', color: 'blue'   },
  rented:   { label: '대여중', color: 'orange' },
  returned: { label: '반납됨', color: 'return' },
}

const STATE_CHANGE_OPTIONS = [
  { value: 'in_use',  label: '사용중' },
  { value: 'stored',  label: '보관중' },
  { value: 'rented',  label: '대여중' },
]

const STATE_FILTER_OPTIONS = [
  { value: 'in_use',   label: '사용중' },
  { value: 'stored',   label: '보관중' },
  { value: 'rented',   label: '대여중' },
  { value: 'returned', label: '반납됨' },
]

const EMPTY_FILTER = {
  project_id:   '',
  item_type_id: '',
  state:        '',
  keyword:      '',
}
// ─────────────────────────────────────────────────────────────────────────────

const DfAssetsListPage = ({ role }) => {
  const queryClient = useQueryClient()

  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)

  const [activeMode,   setActiveMode]   = useState(null)
  const [selectedIds,  setSelectedIds]  = useState([])
  const [stateTarget,  setStateTarget]  = useState('stored')
  const [moveLocation, setMoveLocation] = useState('')
  const [showConfirm,  setShowConfirm]  = useState(false)

  const { data: dashboard } = useQuery({
    queryKey: ['dfDashboard'],
    queryFn:  fetchDfDashboard,
  })
  const projectOptions = dashboard?.projectOptions ?? []
  const typeOptions    = dashboard?.typeOptions    ?? []

  // ── 분류 계층 — parentCategoryName/subCategoryName 보정용 ───────────
  const { data: typeGroups = [] } = useQuery({
    queryKey: ['dfItemTypes'],
    queryFn:  fetchDfItemTypes,
  })

  const typeInfoMap = useMemo(() => {
    const map = {}
    typeGroups.forEach((group) => {
      map[group.id] = { parentName: group.name, childName: null }
      group.children?.forEach((child) => {
        map[child.id] = { parentName: group.name, childName: child.name }
      })
    })
    return map
  }, [typeGroups])

  // ── keyword는 API에 보내지 않고 클라이언트에서 필터링 ──────────────────────
  const apiParams = useMemo(() => {
    const { keyword: _keyword, ...rest } = appliedFilters
    return Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== '' && v != null)
    )
  }, [appliedFilters])

  const { data: assetData, isLoading } = useQuery({
    queryKey: ['dfAssets', apiParams],
    queryFn:  () => fetchDfAssets(apiParams),
  })

  // parentCategoryName / subCategoryName 이 null 인 경우 typeInfoMap 으로 보정
  // + 클라이언트 키워드 필터 (초성 검색 포함)
  const rows = useMemo(() => {
    const allRows = (assetData?.rows ?? []).map((row) => {
      const info = typeInfoMap[row.itemTypeId]
      return {
        ...row,
        parentCategoryName: row.parentCategoryName ?? info?.parentName ?? null,
        subCategoryName:    row.subCategoryName    ?? info?.childName  ?? null,
      }
    })

    if (!appliedFilters.keyword) return allRows

    return allRows
      .filter((row) =>
        matchesAnyField(
          [row.modelName, row.serialNumber, row.location, row.manufacturer, row.projectName],
          appliedFilters.keyword
        )
      )
      .map((row, i) => ({ ...row, no: i + 1 }))
  }, [assetData, typeInfoMap, appliedFilters.keyword])

  const isReturnedFilter = appliedFilters.state === 'returned'

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
    queryClient.invalidateQueries({ queryKey: ['dfDashboard'] })
  }

  const stateMutation = useMutation({
    mutationFn: () => changeDfAssetState({ item_ids: selectedIds, state: stateTarget }),
    onSuccess:  (res) => { toast.success(res?.message ?? '상태가 변경되었습니다.'); invalidate(); resetMode() },
    onError:    (err) => toast.error(err.message),
  })

  const moveMutation = useMutation({
    mutationFn: () => moveDfAssets({ item_ids: selectedIds, location: moveLocation }),
    onSuccess:  (res) => { toast.success(res?.message ?? '자산이 이동되었습니다.'); invalidate(); resetMode() },
    onError:    (err) => toast.error(err.message),
  })

  const returnMutation = useMutation({
    mutationFn: () => returnDfAssets({ item_ids: selectedIds }),
    onSuccess:  (res) => { toast.success(res?.message ?? '자산이 반납되었습니다.'); invalidate(); resetMode() },
    onError:    (err) => toast.error(err.message),
  })

  const isMutating = stateMutation.isPending || moveMutation.isPending || returnMutation.isPending

  const handleFilterChange = (key, value) =>
    setFilterForm((prev) => ({ ...prev, [key]: value }))

  const handleSelectChange = (key, value) => {
    setFilterForm((prev) => ({ ...prev, [key]: value }))
    setAppliedFilters((prev) => ({ ...prev, [key]: value }))
    resetMode()
  }

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
    resetMode()
  }

  const handleSearch = () => {
    setAppliedFilters(filterForm)
    resetMode()
  }

  const handleModeEnter = (mode) => {
    setSelectedIds([])
    setActiveMode(mode)
    if (mode === 'stateChange') setStateTarget('stored')
    if (mode === 'move')        setMoveLocation('')
  }

  const resetMode = () => {
    setActiveMode(null)
    setSelectedIds([])
    setShowConfirm(false)
  }

  const handleConfirmClick = () => {
    if (selectedIds.length === 0) { toast.error('자산을 선택해주세요.'); return }
    if (activeMode === 'move' && !moveLocation.trim()) { toast.error('이동할 위치를 입력해주세요.'); return }
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (activeMode === 'stateChange') stateMutation.mutate()
    else if (activeMode === 'move')   moveMutation.mutate()
    else if (activeMode === 'return') returnMutation.mutate()
  }

  const handleExport = async () => {
    try {
      await exportDfAssets(apiParams)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const confirmTitle = useMemo(() => {
    if (activeMode === 'stateChange') {
      const label = STATE_CHANGE_OPTIONS.find((o) => o.value === stateTarget)?.label ?? stateTarget
      return `선택한 자산 ${selectedIds.length}개를 "${label}" 상태로 변경할까요?`
    }
    if (activeMode === 'move')   return `선택한 자산 ${selectedIds.length}개를 "${moveLocation}"으로 이동할까요?`
    if (activeMode === 'return') return `선택한 자산 ${selectedIds.length}개를 반납할까요?`
    return ''
  }, [activeMode, selectedIds, stateTarget, moveLocation])

  return (
    <div className={common.page}>
      <PageHeader
        title="DF 자산 전체 조회"
        desc={<BackButton label="DF 자산 현황" to={`/${role}/df-assets/dashboard`} />}
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.project_id}
              onChange={(e) => handleSelectChange('project_id', e.target.value)}
            >
              <option value="">프로젝트 전체</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.item_type_id}
              onChange={(e) => handleSelectChange('item_type_id', e.target.value)}
            >
              <option value="">분류 전체</option>
              {typeGroups.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {group.children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.state}
              onChange={(e) => handleSelectChange('state', e.target.value)}
            >
              <option value="">자산 상태 전체</option>
              {STATE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

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

          {/* 액션 버튼 영역 */}
          <div className={styles.tableActions}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={isMutating}
            >
              <Download size={13} />
              엑셀 다운로드
            </button>

            {!isReturnedFilter && (
              <div className={styles.actionButtons}>
                {activeMode === null ? (
                  <>
                    <ActionButton variant="black" size="sm" label="상태 변경" onClick={() => handleModeEnter('stateChange')} />
                    <ActionButton variant="blue"  size="sm" label="자산 이동" onClick={() => handleModeEnter('move')} />
                    <ActionButton variant="red"   size="sm" label="반납"      onClick={() => handleModeEnter('return')} />
                  </>
                ) : (
                  <>
                    {activeMode === 'stateChange' && (
                      <select
                        className={`${common.filterSelect} ${styles.modeSelect}`}
                        value={stateTarget}
                        onChange={(e) => setStateTarget(e.target.value)}
                      >
                        {STATE_CHANGE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                    {activeMode === 'move' && (
                      <input
                        className={styles.modeInput}
                        type="text"
                        placeholder="이동할 위치 입력"
                        value={moveLocation}
                        onChange={(e) => setMoveLocation(e.target.value)}
                      />
                    )}
                    <ActionButton variant="white" size="sm" label="취소" onClick={resetMode} disabled={isMutating} />
                    {activeMode === 'stateChange' && (
                      <ActionButton variant="black" size="sm" label="저장"
                        onClick={handleConfirmClick} disabled={isMutating || selectedIds.length === 0} />
                    )}
                    {activeMode === 'move' && (
                      <ActionButton variant="blue" size="sm" label="저장"
                        onClick={handleConfirmClick} disabled={isMutating || selectedIds.length === 0} />
                    )}
                    {activeMode === 'return' && (
                      <ActionButton variant="red" size="sm" label="확인"
                        onClick={handleConfirmClick} disabled={isMutating || selectedIds.length === 0} />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <DataTable
            columns={COLUMNS}
            rows={isLoading ? [] : rows}
            statusMap={STATUS_MAP}
            selectable={activeMode !== null}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalCount={rows.length}
            highlight={appliedFilters.keyword}
          />
        </Card>
      </section>

      <ConfirmModal
        isOpen={showConfirm}
        title={confirmTitle}
        desc={activeMode === 'return' ? '반납된 자산은 목록에서 제외됩니다.' : undefined}
        confirmLabel={
          activeMode === 'stateChange' ? '변경' :
          activeMode === 'move'        ? '이동' : '반납'
        }
        confirmVariant={activeMode === 'return' ? 'danger' : 'primary'}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

export default DfAssetsListPage
