import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import Card from '../../../components/Card/Card'
import DataTable from '../../../components/DataTable/DataTable'
import PageHeader from '../../../components/PageHeader/PageHeader'
import ActionButton from '../../../components/ActionButton/ActionButton'
import BackButton from '../../../components/BackButton/BackButton'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal'
import {
  fetchEnterpriseList,
  changeEnterpriseState,
  moveEnterpriseAssets,
  returnEnterpriseAssets,
} from '../../../services/assetService'
import common from '../../AssetPage.common.module.css'
import styles from './AdminPcAssetsPage.module.css'


// ── 상수 ─────────────────────────────────────────────────────────────────────
const PC_COLUMNS = [
  { key: 'no',             label: 'No' },
  { key: 'itemNumber',     label: '자산번호',   type: 'dash' },
  { key: 'departmentName', label: '소관부서',   type: 'dash' },
  { key: 'location',       label: '위치',       type: 'dash' },
  { key: 'userName',       label: '담당자',     type: 'dash' },
  { key: 'acquiredAt',     label: '취득일',     type: 'dash' },
  { key: 'manufacturer',   label: '제조사',     type: 'dash' },
  { key: 'itemTypeName',   label: '자산 종류',  type: 'dash' },
  { key: 'spec',           label: '규격',       type: 'dash' },
  { key: 'serialNumber',   label: '시리얼 번호', type: 'dash' },
  { key: 'remarks',        label: '비고',       type: 'dash' },
  { key: 'state',          label: '상태',       type: 'status' },
]

const STATUS_MAP = {
  in_use:   { label: '사용중', color: 'green' },
  stored:   { label: '보관중', color: 'blue'  },
  returned: { label: '반납됨', color: 'return' },
}

const PC_STATE_OPTIONS = [
  { value: 'in_use', label: '사용중' },
  { value: 'stored', label: '보관중' },
]

const EMPTY_FILTER = {
  category_id:  '',
  item_type_id: '',
  state:        '',
  keyword:      '',
}
// ─────────────────────────────────────────────────────────────────────────────

const AdminPcAssetsPage = () => {
  const queryClient = useQueryClient()

  // ── 필터 ─────────────────────────────────────────────────────────────────
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)

  // ── 모드: null | 'stateChange' | 'move' | 'return' ───────────────────────
  const [activeMode,   setActiveMode]   = useState(null)
  const [selectedIds,  setSelectedIds]  = useState([])
  const [stateTarget,  setStateTarget]  = useState('stored')
  const [moveLocation, setMoveLocation] = useState('')
  const [showConfirm,  setShowConfirm]  = useState(false)

  // ── 자산 조회 ─────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['enterpriseList', appliedFilters],
    queryFn:  () => fetchEnterpriseList(appliedFilters),
    refetchOnWindowFocus: false,
  })
  const rows       = data?.rows       ?? []
  const categories = data?.categories ?? []
  const itemTypes  = data?.itemTypes  ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['enterpriseList'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['personalHistory'] })
  }

  const stateMutation = useMutation({
    mutationFn: () => changeEnterpriseState({ asset_ids: selectedIds, state: stateTarget }),
    onSuccess:  (res) => { toast.success(res?.message ?? '상태가 변경되었습니다.'); invalidate(); resetMode() },
    onError:    (err) => toast.error(err.message),
  })

  const moveMutation = useMutation({
    mutationFn: () => moveEnterpriseAssets({ asset_ids: selectedIds, location: moveLocation }),
    onSuccess:  (res) => { toast.success(res?.message ?? '자산이 이동되었습니다.'); invalidate(); resetMode() },
    onError:    (err) => toast.error(err.message),
  })

  const returnMutation = useMutation({
    mutationFn: () => returnEnterpriseAssets({ asset_ids: selectedIds }),
    onSuccess:  (res) => { toast.success(res?.message ?? '자산이 반납되었습니다.'); invalidate(); resetMode() },
    onError:    (err) => toast.error(err.message),
  })

  const isMutating =
    stateMutation.isPending || moveMutation.isPending || returnMutation.isPending

  // ── 필터 핸들러 ───────────────────────────────────────────────────────────
  const handleFilterChange = (key, value) =>
    setFilterForm((prev) => ({ ...prev, [key]: value }))

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
  }

  const handleSearch = () => setAppliedFilters(filterForm)

  // ── 모드 핸들러 ───────────────────────────────────────────────────────────
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

  const confirmTitle = useMemo(() => {
    if (activeMode === 'stateChange') {
      const label = PC_STATE_OPTIONS.find((o) => o.value === stateTarget)?.label ?? stateTarget
      return `선택한 자산 ${selectedIds.length}개를 "${label}" 상태로 변경할까요?`
    }
    if (activeMode === 'move')   return `선택한 자산 ${selectedIds.length}개를 "${moveLocation}"으로 이동할까요?`
    if (activeMode === 'return') return `선택한 자산 ${selectedIds.length}개를 반납할까요?`
    return ''
  }, [activeMode, selectedIds, stateTarget, moveLocation])

  return (
    <div className={common.page}>
      <PageHeader
        title="PC 전체 조회"
        desc={<BackButton label="내 자산 관리" to="/admin/my-assets" />}
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.category_id}
              onChange={(e) => handleFilterChange('category_id', e.target.value)}
            >
              <option value="">카테고리 전체</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.item_type_id}
              onChange={(e) => handleFilterChange('item_type_id', e.target.value)}
            >
              <option value="">자산 종류 전체</option>
              {itemTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
            >
              <option value="">자산 상태 전체</option>
              {PC_STATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <ActionButton variant="white" size="sm" label="초기화" onClick={handleFilterReset} />

            <div className={common.filterSearchWrap}>
              <input
                type="text"
                className={common.filterInput}
                placeholder="제조사 / 시리얼 / 규격 / 위치 검색"
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
                    className={common.filterSelect}
                    value={stateTarget}
                    onChange={(e) => setStateTarget(e.target.value)}
                  >
                    {PC_STATE_OPTIONS.map((opt) => (
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
                    onClick={handleConfirmClick}
                    disabled={isMutating || selectedIds.length === 0}
                  />
                )}
                {activeMode === 'move' && (
                  <ActionButton variant="blue" size="sm" label="저장"
                    onClick={handleConfirmClick}
                    disabled={isMutating || selectedIds.length === 0}
                  />
                )}
                {activeMode === 'return' && (
                  <ActionButton variant="red" size="sm" label="확인"
                    onClick={handleConfirmClick}
                    disabled={isMutating || selectedIds.length === 0}
                  />
                )}
              </>
            )}
          </div>

          <DataTable
            columns={PC_COLUMNS}
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

export default AdminPcAssetsPage