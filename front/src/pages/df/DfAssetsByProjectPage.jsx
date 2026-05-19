import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Download } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import Card from '../../components/Card/Card'
import DataTable from '../../components/DataTable/DataTable'
import PageHeader from '../../components/PageHeader/PageHeader'
import ActionButton from '../../components/ActionButton/ActionButton'
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
import styles from './DfAssetsByProjectPage.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  in_use:   { label: '사용중', color: 'green'  },
  stored:   { label: '보관중', color: 'blue'   },
  rented:   { label: '대여중', color: 'orange' },
  returned: { label: '반납됨', color: 'return' },
}

const PC_COLUMNS = [
  { key: 'no',              label: 'No',          width: '48px' },
  { key: 'subCategoryName', label: '분류',            },
  { key: 'ownerOrg',        label: '소유 기관',       },
  { key: 'equipmentNo',     label: '장비 번호',       },
  { key: 'manufacturer',    label: '제조사',          },
  { key: 'productName',     label: '제품명',          },
  { key: 'modelName',       label: '모델명',          },
  { key: 'serialNumber',    label: '시리얼 번호',     },
  { key: 'quantity',        label: '수량',            },
  { key: 'spec',            label: '규격',            },
  { key: 'location',        label: '위치',            },
  { key: 'acquiredAt',      label: '대여일',       noHighlight: true },
  { key: 'returnedAt',      label: '반납일',       noHighlight: true },
  { key: 'remarks',         label: '비고',            },
  { key: 'state',           label: '상태',        type: 'status'},
]

const PLC_COLUMNS = [
  { key: 'no',              label: 'No',          width: '48px' },
  { key: 'subCategoryName', label: '분류',            },
  { key: 'ownerOrg',        label: '소유 기관',       },
  { key: 'equipmentNo',     label: '장비 번호',       },
  { key: 'serialNumber',    label: '시리얼 번호',     },
  { key: 'quantity',        label: '수량',            },
  { key: 'spec',            label: '규격',            },
  { key: 'location',        label: '위치',            },
  { key: 'acquiredAt',      label: '대여일',          },
  { key: 'returnedAt',      label: '반납일',          },
  { key: 'remarks',         label: '비고',            },
  { key: 'state',           label: '상태',        type: 'status'},
]

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
  item_type_id: '',
  state:        '',
  keyword:      '',
}
// ─────────────────────────────────────────────────────────────────────────────

const DfAssetsByProjectPage = ({ role }) => {
  const queryClient = useQueryClient()

  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project_id') ? Number(searchParams.get('project_id')) : null

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
  const typeOptions = dashboard?.typeOptions ?? []

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

  // 프로젝트명 (breadcrumbExtra로 전달)
  const projectName = useMemo(() => {
    if (!projectId) return null
    return dashboard?.projectOptions?.find((p) => p.id === projectId)?.name ?? null
  }, [dashboard, projectId])

  // ── keyword는 API에 보내지 않고 클라이언트에서 필터링 ──────────────────────
  const apiParams = useMemo(() => {
    const { keyword: _keyword, ...rest } = appliedFilters
    const params = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== '' && v != null)
    )
    if (projectId) params.project_id = projectId
    return params
  }, [projectId, appliedFilters])

  const { data: assetData, isLoading } = useQuery({
    queryKey: ['dfAssets', apiParams],
    queryFn:  () => fetchDfAssets(apiParams),
  })
  const allRows = assetData?.rows ?? []

  // ── API 응답 보정 + 클라이언트 키워드 필터 — 전체 컬럼 대상 ─────────────
  const resolvedRows = useMemo(() => {
    const corrected = allRows.map((row) => {
      const info = typeInfoMap[row.itemTypeId]
      return {
        ...row,
        parentCategoryName: row.parentCategoryName ?? info?.parentName ?? null,
        subCategoryName:    row.subCategoryName    ?? info?.childName  ?? null,
      }
    })

    if (!appliedFilters.keyword) return corrected

    return corrected.filter((row) =>
      matchesAnyField(
        [
          row.subCategoryName, row.ownerOrg,     row.equipmentNo,
          row.manufacturer,    row.productName,  row.modelName,
          row.serialNumber,    row.spec,         row.location,
          row.remarks,
        ],
        appliedFilters.keyword
      )
    )
  }, [allRows, typeInfoMap, appliedFilters.keyword])

  // ── PC / PLC / 기타 분리 ──────────────────────────────────────────────────
  const pcRows  = useMemo(
    () => resolvedRows.filter((r) => r.parentCategoryName === 'PC')
                      .map((r, i) => ({ ...r, no: i + 1 })),
    [resolvedRows]
  )
  const plcRows = useMemo(
    () => resolvedRows.filter((r) => r.parentCategoryName === 'PLC')
                      .map((r, i) => ({ ...r, no: i + 1 })),
    [resolvedRows]
  )
  const etcRows = useMemo(
    () => resolvedRows.filter((r) => r.parentCategoryName !== 'PC' && r.parentCategoryName !== 'PLC')
                      .map((r, i) => ({ ...r, no: i + 1 })),
    [resolvedRows]
  )

  // ── 프로젝트가 보유한 카테고리 파악 ─────────────────────────────────────
  const projectCategories = useMemo(() => {
    if (!projectId) return new Set(['PC', 'PLC'])
    const selectedProject = dashboard?.projectOptions?.find((p) => p.id === projectId)
    if (!selectedProject?.typeIds?.length) return new Set(['PC', 'PLC'])
    const cats = new Set()
    selectedProject.typeIds.forEach((tid) => {
      const info = typeInfoMap[tid]
      if (info?.parentName) cats.add(info.parentName)
    })
    return cats
  }, [projectId, dashboard, typeInfoMap])

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

  // ── 액션 버튼 영역 ────────────────────────────────────────────────────────
  const renderActions = () => {
    if (isReturnedFilter) return null
    if (activeMode === null) return (
      <>
        <ActionButton variant="black" size="sm" label="상태 변경" onClick={() => handleModeEnter('stateChange')} />
        <ActionButton variant="blue"  size="sm" label="자산 이동" onClick={() => handleModeEnter('move')} />
        <ActionButton variant="red"   size="sm" label="반납"      onClick={() => handleModeEnter('return')} />
      </>
    )
    return (
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
    )
  }

  return (
    <div className={common.page}>
      <PageHeader
        title={projectName ?? 'DF 자산 현황'}
        breadcrumbExtra={projectName ?? undefined}
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.item_type_id}
              onChange={(e) => handleSelectChange('item_type_id', e.target.value)}
            >
              <option value="">분류 전체</option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
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

          {/* 액션 버튼 + 엑셀 */}
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
            <div className={styles.actionButtons}>
              {renderActions()}
            </div>
          </div>

          {/* PC 테이블 */}
          {projectCategories.has('PC') && (
            <DataTable
              columns={PC_COLUMNS}
              rows={isLoading ? [] : pcRows}
              statusMap={STATUS_MAP}
              selectable={activeMode !== null}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              totalCount={isLoading ? 0 : pcRows.length}
              highlight={appliedFilters.keyword}
            />
          )}

          {/* PLC 테이블 */}
          {projectCategories.has('PLC') && (
            <DataTable
              columns={PLC_COLUMNS}
              rows={isLoading ? [] : plcRows}
              statusMap={STATUS_MAP}
              selectable={activeMode !== null}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              totalCount={isLoading ? 0 : plcRows.length}
              highlight={appliedFilters.keyword}
            />
          )}

          {/* 기타 */}
          {etcRows.length > 0 && (
            <DataTable
              columns={PLC_COLUMNS}
              rows={etcRows}
              statusMap={STATUS_MAP}
              selectable={activeMode !== null}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              totalCount={etcRows.length}
              highlight={appliedFilters.keyword}
            />
          )}

          {/* 프로젝트 미선택 + 데이터 없음 */}
          {!isLoading && !projectId && resolvedRows.length === 0 && (
            <DataTable
              columns={PC_COLUMNS}
              rows={[]}
              statusMap={STATUS_MAP}
              selectable={false}
              totalCount={0}
            />
          )}

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

export default DfAssetsByProjectPage
