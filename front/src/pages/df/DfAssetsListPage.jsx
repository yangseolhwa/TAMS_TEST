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
import {
  fetchDfDashboard,
  fetchDfAssets,
  changeDfAssetState,
  moveDfAssets,
  returnDfAssets,
  exportDfAssets,
} from '../../services/assetService'
import common from '../AssetPage.common.module.css'
import styles from './DfAssetsListPage.module.css'

// ── 상수 ────────────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'no',            label: 'No'        },
  { key: 'projectName',   label: '프로젝트명',  type: 'dash' },
  { key: 'ownerOrg',      label: '소유 기관',   type: 'dash' },
  { key: 'majorCategory', label: '자산 대분류', type: 'dash' },
  { key: 'minorCategory', label: '자산 중분류', type: 'dash' },
  { key: 'modelName',     label: '모델명',      type: 'dash' },
  { key: 'spec',          label: '규격',        type: 'dash' },
  { key: 'manufacturer',  label: '제조사',      type: 'dash' },
  { key: 'serialNumber',  label: '시리얼 번호', type: 'dash' },
  { key: 'acquiredAt',    label: '취득일',      type: 'dash' },
  { key: 'returnedAt',    label: '반납일',      type: 'dash' },
  { key: 'location',      label: '위치',        type: 'dash' },
  { key: 'state',         label: '상태',        type: 'status' },
]

const STATUS_MAP = {
  in_use:   { label: '사용중', color: 'green'  },
  stored:   { label: '보관중', color: 'blue'   },
  rented:   { label: '대여중', color: 'orange' },
  returned: { label: '반납됨', color: 'return' },
}

const STATE_OPTIONS = [
  { value: 'in_use',  label: '사용중' },
  { value: 'stored',  label: '보관중' },
  { value: 'rented',  label: '대여중' },
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

  // ── 필터 ──────────────────────────────────────────────────────────────────
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)

  // ── 모드: null | 'stateChange' | 'move' | 'return' ────────────────────────
  const [activeMode,    setActiveMode]    = useState(null)
  const [selectedIds,   setSelectedIds]   = useState([])
  const [stateTarget,   setStateTarget]   = useState('stored')   // 상태변경 대상 상태
  const [moveLocation,  setMoveLocation]  = useState('')         // 이동 목적지

  // ── 확인 모달 ──────────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false)

  // ── 대시보드 (필터 옵션용) ─────────────────────────────────────────────────
  const { data: dashboard } = useQuery({
    queryKey: ['dfDashboard'],
    queryFn:  fetchDfDashboard,
    refetchOnWindowFocus: false,
  })
  const projectOptions = dashboard?.projectOptions ?? []
  const typeOptions    = dashboard?.typeOptions    ?? []

  // ── 자산 조회 ──────────────────────────────────────────────────────────────
  const { data: assetData, isLoading } = useQuery({
    queryKey: ['dfAssets', appliedFilters],
    queryFn:  () => fetchDfAssets(appliedFilters),
    refetchOnWindowFocus: false,
  })
  const rows = assetData?.rows ?? []

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
    queryClient.invalidateQueries({ queryKey: ['dfDashboard'] })
  }

  const stateMutation = useMutation({
    mutationFn: () => changeDfAssetState({ item_ids: selectedIds, state: stateTarget }),
    onSuccess:  (res) => {
      toast.success(res?.message ?? '상태가 변경되었습니다.')
      invalidate()
      resetMode()
    },
    onError: (err) => toast.error(err.message),
  })

  const moveMutation = useMutation({
    mutationFn: () => moveDfAssets({ item_ids: selectedIds, location: moveLocation }),
    onSuccess:  (res) => {
      toast.success(res?.message ?? '자산이 이동되었습니다.')
      invalidate()
      resetMode()
    },
    onError: (err) => toast.error(err.message),
  })

  const returnMutation = useMutation({
    mutationFn: () => returnDfAssets({ item_ids: selectedIds }),
    onSuccess:  (res) => {
      toast.success(res?.message ?? '자산이 반납되었습니다.')
      invalidate()
      resetMode()
    },
    onError: (err) => toast.error(err.message),
  })

  const isMutating =
    stateMutation.isPending || moveMutation.isPending || returnMutation.isPending

  // ── 필터 핸들러 ────────────────────────────────────────────────────────────
  const handleFilterChange = (key, value) =>
    setFilterForm((prev) => ({ ...prev, [key]: value }))

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
  }

  const handleSearch = () => setAppliedFilters(filterForm)

  // ── 모드 핸들러 ────────────────────────────────────────────────────────────
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
    if (selectedIds.length === 0) {
      toast.error('자산을 선택해주세요.')
      return
    }
    if (activeMode === 'move' && !moveLocation.trim()) {
      toast.error('이동할 위치를 입력해주세요.')
      return
    }
    setShowConfirm(true)
  }

  const handleConfirm = () => {
    if (activeMode === 'stateChange') stateMutation.mutate()
    else if (activeMode === 'move')   moveMutation.mutate()
    else if (activeMode === 'return') returnMutation.mutate()
  }

  // ── 엑셀 다운로드 ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      await exportDfAssets(appliedFilters)
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ── 모달 타이틀 / 설명 ────────────────────────────────────────────────────
  const confirmTitle = useMemo(() => {
    if (activeMode === 'stateChange') {
      const label = STATE_OPTIONS.find((o) => o.value === stateTarget)?.label ?? stateTarget
      return `선택한 자산 ${selectedIds.length}개를 "${label}" 상태로 변경할까요?`
    }
    if (activeMode === 'move')   return `선택한 자산 ${selectedIds.length}개를 "${moveLocation}"으로 이동할까요?`
    if (activeMode === 'return') return `선택한 자산 ${selectedIds.length}개를 반납할까요?`
    return ''
  }, [activeMode, selectedIds, stateTarget, moveLocation])

  const confirmDesc = activeMode === 'return'
    ? '반납된 자산은 목록에서 제외됩니다.'
    : undefined

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
              onChange={(e) => handleFilterChange('project_id', e.target.value)}
            >
              <option value="">프로젝트 전체</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.item_type_id}
              onChange={(e) => handleFilterChange('item_type_id', e.target.value)}
            >
              <option value="">자산 종류 전체</option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
            >
              <option value="">자산 상태 전체</option>
              {STATE_OPTIONS.map((opt) => (
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
            {/* 엑셀 다운로드: 항상 왼쪽 고정 */}
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
              {activeMode === null ? (
                <>
                  <ActionButton variant="black" size="sm" label="상태 변경" onClick={() => handleModeEnter('stateChange')} />
                  <ActionButton variant="blue"  size="sm" label="자산 이동" onClick={() => handleModeEnter('move')} />
                  <ActionButton variant="red"   size="sm" label="반납"      onClick={() => handleModeEnter('return')} />
                </>
              ) : (
                <>
                  {/* 상태 변경 모드: 대상 상태 select */}
                  {activeMode === 'stateChange' && (
                    <select
                      className={`${common.filterSelect} ${styles.modeSelect}`}
                      value={stateTarget}
                      onChange={(e) => setStateTarget(e.target.value)}
                    >
                      {STATE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}

                  {/* 이동 모드: 위치 입력 */}
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
                    <ActionButton
                      variant="black" size="sm" label="저장"
                      onClick={handleConfirmClick}
                      disabled={isMutating || selectedIds.length === 0}
                    />
                  )}
                  {activeMode === 'move' && (
                    <ActionButton
                      variant="blue" size="sm" label="저장"
                      onClick={handleConfirmClick}
                      disabled={isMutating || selectedIds.length === 0}
                    />
                  )}
                  {activeMode === 'return' && (
                    <ActionButton
                      variant="red" size="sm" label="확인"
                      onClick={handleConfirmClick}
                      disabled={isMutating || selectedIds.length === 0}
                    />
                  )}
                </>
              )}
            </div>
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
        desc={confirmDesc}
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