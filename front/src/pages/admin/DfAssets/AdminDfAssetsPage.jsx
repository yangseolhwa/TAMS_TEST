import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ClipboardPlus } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import PageHeader from '../../../components/PageHeader/PageHeader'
import Card from '../../../components/Card/Card'
import DataTable from '../../../components/DataTable/DataTable'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal'
import {
  fetchDfAssets, registerDfAsset, returnDfAssets, moveDfAssets,
  importDfAssets, exportDfAssets,
} from '../../../services/assetService'
import styles from './AdminDfAssetsPage.module.css'

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const DF_COLUMNS = [
  { key: 'no',               label: 'No'       },
  { key: 'project',          label: '프로젝트',  type: 'dash' },
  { key: 'doosanItemNumber', label: '두산',      type: 'dash' },
  { key: 'itemType',         label: '자산 종류', type: 'dash' },
  { key: 'modelName',        label: '자산명',    type: 'dash' },
  { key: 'manufacturer',     label: '제조사',    type: 'dash' },
  { key: 'serialNumber',     label: '시리얼',    type: 'dash' },
  { key: 'quantity',         label: '수량',      type: 'dash' },
  { key: 'rentalStartDate',  label: '등록일',    type: 'dash' },
  { key: 'rentalEndDate',    label: '반납일',    type: 'dash' },
  { key: 'location',         label: '위치',      type: 'dash' },
  { key: 'state',            label: '상태',      type: 'status' },
  { key: 'remarks',          label: '비고',      type: 'dash' },
]

const DF_STATUS_MAP = {
  active: { label: '사용중',   color: 'green'  },
  stored: { label: '보관중',   color: 'blue'   },
  rented: { label: '외부대여', color: 'yellow' },
}

const STATE_OPTIONS = [
  { value: 'active', label: '사용중'   },
  { value: 'stored', label: '보관중'   },
  { value: 'rented', label: '외부대여' },
]

const UNIT_OPTIONS = ['ea', 'set', 'etc']

const PAGE_SIZE = 10

const EMPTY_FILTER = {
  projectId:    '',
  itemTypeId:   '',
  manufacturer: '',
  state:        '',
  keyword:      '',
}

const EMPTY_REG_FORM = {
  isExisting:          false,
  projectId:           '',
  assetTypeId:         '',
  customItemTypeName:  '',
  doosanItemNumber:    '',
  modelName:           '',
  customModelName:     '',
  manufacturer:        '',
  customManufacturer:  '',
  serialNumber:        '',
  spec:                '',
  quantity:            '',
  quantityUnit:        'ea',
  rentalStartDate:     '',
  rentalEndDate:       '',
  location:            '',
  remarks:             '',
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
const AdminDfAssetsPage = () => {
  const queryClient  = useQueryClient()
  const fileInputRef = useRef(null)

  // ── 등록 폼 상태 ─────────────────────────────────────────────────────────
  const [regForm,          setRegForm]          = useState(EMPTY_REG_FORM)
  const [showRegConfirm,   setShowRegConfirm]   = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // ── 조회 필터 상태 ────────────────────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState([])
  const [currentPage,    setCurrentPage]    = useState(1)
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER)

  // ── 반납 관련 상태 ────────────────────────────────────────────────────────
  const [returnMode,        setReturnMode]        = useState(false)
  const [returnRemarks,     setReturnRemarks]     = useState('')
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [showNoSelectModal, setShowNoSelectModal] = useState(false)

  // ── 이동 관련 상태 ────────────────────────────────────────────────────────
  const [moveMode,        setMoveMode]        = useState(false)
  const [moveLocation,    setMoveLocation]    = useState('')
  const [showMoveConfirm, setShowMoveConfirm] = useState(false)

  // ── Export 로딩 상태 ──────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false)

  // ── Base query ────────────────────────────────────────────────────────────
  const { data: baseData } = useQuery({
    queryKey: ['dfAssets', 'base'],
    queryFn:  () => fetchDfAssets(),
    staleTime: Infinity,
  })

  // ── Filtered query ────────────────────────────────────────────────────────
  const { data: filteredData, isLoading, isError } = useQuery({
    queryKey: ['dfAssets', 'filtered', appliedFilters],
    queryFn: () => {
      const params = {}
      if (appliedFilters.projectId)    params.project_id   = appliedFilters.projectId
      if (appliedFilters.itemTypeId)   params.item_type_id = appliedFilters.itemTypeId
      if (appliedFilters.manufacturer) params.manufacturer = appliedFilters.manufacturer
      if (appliedFilters.state)        params.state        = appliedFilters.state
      if (appliedFilters.keyword)      params.keyword      = appliedFilters.keyword
      return fetchDfAssets(params)
    },
  })

  const allRows          = filteredData?.rows             ?? []
  const projectSummaries = (baseData ?? filteredData)?.projectSummaries ?? []

  // ── 드롭다운 옵션 ─────────────────────────────────────────────────────────
  const itemTypeOptions = useMemo(() => {
    const seen = new Map()
    ;(baseData?.rows ?? []).forEach((r) => {
      if (r.itemTypeId && !seen.has(r.itemTypeId))
        seen.set(r.itemTypeId, r.itemType)
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [baseData])

  const manufacturerOptions = useMemo(() => {
    const set = new Set(
      (baseData?.rows ?? []).map((r) => r.manufacturer).filter(Boolean)
    )
    return Array.from(set)
  }, [baseData])

  const modelNameOptions = useMemo(() => {
    const set = new Set(
      (baseData?.rows ?? []).map((r) => r.modelName).filter(Boolean)
    )
    return Array.from(set)
  }, [baseData])

  // ── 등록 Mutation ─────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: registerDfAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      toast.success('DF 자산이 등록되었습니다.')
      setRegForm(EMPTY_REG_FORM)
      setShowRegConfirm(false)
    },
    onError: (err) => {
      toast.error(err.message)
      setShowRegConfirm(false)
    },
  })

  // ── 반납 Mutation ─────────────────────────────────────────────────────────
  const returnMutation = useMutation({
    mutationFn: returnDfAssets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      toast.success('반납이 완료되었습니다.')
      cancelReturnMode()
    },
    onError: (err) => {
      toast.error(err.message)
      setShowReturnConfirm(false)
    },
  })

  // ── 이동 Mutation ─────────────────────────────────────────────────────────
  const moveMutation = useMutation({
    mutationFn: moveDfAssets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      toast.success('자산 위치가 변경되었습니다.')
      cancelMoveMode()
    },
    onError: (err) => {
      toast.error(err.message)
      setShowMoveConfirm(false)
    },
  })

  // ── Import Mutation ───────────────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: importDfAssets,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      const { imported, failed } = data
      if (failed === 0) {
        toast.success(`Import 완료: ${imported}건 성공`)
      } else {
        toast.error(`Import 완료: ${imported}건 성공, ${failed}건 실패`)
      }
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  // ── Import 핸들러 ─────────────────────────────────────────────────────────
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    importMutation.mutate(file)
    // 같은 파일 재업로드 허용을 위해 value 초기화
    e.target.value = ''
  }

  // ── Export 핸들러 ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const params = {}
      if (appliedFilters.projectId)    params.project_id   = appliedFilters.projectId
      if (appliedFilters.itemTypeId)   params.item_type_id = appliedFilters.itemTypeId
      if (appliedFilters.manufacturer) params.manufacturer = appliedFilters.manufacturer
      if (appliedFilters.state)        params.state        = appliedFilters.state
      if (appliedFilters.keyword)      params.keyword      = appliedFilters.keyword
      await exportDfAssets(params)
      toast.success('엑셀 파일이 다운로드되었습니다.')
    } catch (err) {
      // blob 응답의 경우 에러 메시지 파싱
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text().catch(() => '')
        try {
          const json = JSON.parse(text)
          toast.error(json.message ?? 'Export에 실패했습니다.')
        } catch {
          toast.error('Export에 실패했습니다.')
        }
      } else {
        toast.error(err.message ?? 'Export에 실패했습니다.')
      }
    } finally {
      setIsExporting(false)
    }
  }

  // ── 반납 핸들러 ───────────────────────────────────────────────────────────
  const handleReturnClick = () => {
    if (selectedIds.length === 0) { setShowNoSelectModal(true); return }
    setReturnMode(true)
  }
  const handleReturnConfirmClick = () => setShowReturnConfirm(true)
  const handleReturnConfirm = () => {
    returnMutation.mutate({ item_ids: selectedIds })
    setShowReturnConfirm(false)
  }
  const cancelReturnMode = () => {
    setReturnMode(false)
    setReturnRemarks('')
    setSelectedIds([])
    setShowReturnConfirm(false)
  }

  // ── 이동 핸들러 ───────────────────────────────────────────────────────────
  const handleMoveClick = () => {
    if (selectedIds.length === 0) { setShowNoSelectModal(true); return }
    setMoveMode(true)
  }
  const handleMoveSaveClick = () => {
    if (!moveLocation.trim()) { toast.error('이동할 위치를 입력해주세요.'); return }
    setShowMoveConfirm(true)
  }
  const handleMoveConfirm = () => {
    moveMutation.mutate({ item_ids: selectedIds, location: moveLocation.trim() })
    setShowMoveConfirm(false)
  }
  const cancelMoveMode = () => {
    setMoveMode(false)
    setMoveLocation('')
    setSelectedIds([])
    setShowMoveConfirm(false)
  }

  // ── 등록 폼 핸들러 ────────────────────────────────────────────────────────
  const handleRegChange = (field, value) => {
    setRegForm((prev) => ({ ...prev, [field]: value }))
  }

  const isRegFormValid = () => {
    const {
      isExisting, projectId, assetTypeId, customItemTypeName,
      modelName, customModelName, manufacturer, customManufacturer,
      quantity, rentalStartDate,
    } = regForm
    if (!projectId || !assetTypeId || !quantity || !rentalStartDate) return false
    if (assetTypeId === '__custom__' && !customItemTypeName.trim()) return false
    if (!isExisting) {
      if (!modelName.trim() || !manufacturer.trim()) return false
    } else {
      if (modelName === '__custom__' && !customModelName.trim()) return false
      if (manufacturer === '__custom__' && !customManufacturer.trim()) return false
    }
    return true
  }

  const handleRegSubmit = () => {
    if (!isRegFormValid()) { toast.error('필수 항목을 모두 입력해주세요.'); return }
    setShowRegConfirm(true)
  }

  const handleRegConfirm = () => {
    const isCustomType         = regForm.assetTypeId    === '__custom__'
    const isCustomModelName    = regForm.modelName      === '__custom__'
    const isCustomManufacturer = regForm.manufacturer   === '__custom__'
    const resolvedModelName    = isCustomModelName    ? regForm.customModelName.trim()    : regForm.modelName.trim()    || undefined
    const resolvedManufacturer = isCustomManufacturer ? regForm.customManufacturer.trim() : regForm.manufacturer.trim() || undefined

    const body = {
      project_id:  Number(regForm.projectId),
      is_existing: regForm.isExisting,
      items: [{
        ...(isCustomType
          ? { asset_type_name: regForm.customItemTypeName.trim() }
          : { asset_type_id:   Number(regForm.assetTypeId) }
        ),
        doosan_item_number: regForm.doosanItemNumber.trim() || undefined,
        model_name:         resolvedModelName,
        manufacturer:       resolvedManufacturer,
        serial_number:      regForm.serialNumber.trim()     || undefined,
        spec:               regForm.spec.trim()             || undefined,
        quantity:           Number(regForm.quantity),
        quantity_unit:      regForm.quantityUnit,
        rental_start_date:  regForm.rentalStartDate,
        rental_end_date:    regForm.rentalEndDate            || undefined,
        location:           regForm.location.trim()         || undefined,
        remarks:            regForm.remarks.trim()          || undefined,
      }],
    }
    registerMutation.mutate(body)
  }

  // ── 조회 필터 핸들러 ──────────────────────────────────────────────────────
  const handleFilterChange = (field, value) => {
    setFilterForm((prev) => ({ ...prev, [field]: value }))
  }
  const handleSearch = () => {
    setAppliedFilters({ ...filterForm })
    setCurrentPage(1)
    setSelectedIds([])
  }
  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
    setCurrentPage(1)
    setSelectedIds([])
  }
  const handleCardClick = (projectId) => {
    const next = { ...EMPTY_FILTER, projectId: String(projectId) }
    setFilterForm(next)
    setAppliedFilters(next)
    setCurrentPage(1)
    setSelectedIds([])
  }
  const handleCardAllClick = () => {
    setFilterForm(EMPTY_FILTER)
    setAppliedFilters(EMPTY_FILTER)
    setCurrentPage(1)
    setSelectedIds([])
  }

  // ── 페이지네이션 ──────────────────────────────────────────────────────────
  const totalCount = allRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage   = Math.min(currentPage, totalPages)

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return allRows.slice(start, start + PAGE_SIZE)
  }, [allRows, safePage])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    setSelectedIds([])
  }

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const half  = 3
    let start   = Math.max(1, safePage - half)
    let end     = Math.min(totalPages, safePage + half)
    if (end - start < 6) {
      if (start === 1) end   = Math.min(totalPages, 7)
      else             start = Math.max(1, end - 6)
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [safePage, totalPages])

  // ─────────────────────────────────────────────────────────────────────────
  const isBusy = returnMode || moveMode

  return (
    <div className={styles.page}>
      <PageHeader
        title="DF 자산 관리"
        desc="DF 장비의 등록, 조회 및 위치 변동을 수행합니다."
      />

      {/* ════ DF 자산 등록 섹션 ════════════════════════════════════════════ */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <ClipboardPlus size={15} />
          <span>DF 자산 등록</span>
        </div>

        <Card>
          {/* ── 기존 / 신규 라디오 ── */}
          <div className={styles.radioRow}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="df-reg-type"
                checked={!regForm.isExisting}
                onChange={() => setRegForm((prev) => ({ ...prev, isExisting: false }))}
              />
              신규 자산
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="df-reg-type"
                checked={regForm.isExisting}
                onChange={() => setRegForm((prev) => ({
                  ...prev,
                  isExisting: true,
                  assetTypeId:        prev.assetTypeId === '__custom__' ? '' : prev.assetTypeId,
                  customItemTypeName: '',
                  modelName:          prev.modelName === '__custom__' ? '' : prev.modelName,
                  customModelName:    '',
                  manufacturer:       prev.manufacturer === '__custom__' ? '' : prev.manufacturer,
                  customManufacturer: '',
                }))}
              />
              기존 자산
            </label>
          </div>

          <div className={styles.formGrid}>
            {/* 프로젝트 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>프로젝트 <span className={styles.required}>*</span></label>
              <select className={styles.select} value={regForm.projectId} onChange={(e) => handleRegChange('projectId', e.target.value)}>
                <option value="">선택</option>
                {projectSummaries.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.name}</option>
                ))}
              </select>
            </div>

            {/* 자산 종류 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>자산 종류 <span className={styles.required}>*</span></label>
              {regForm.assetTypeId === '__custom__' ? (
                <div className={styles.customTypeWrap}>
                  <input className={styles.input} type="text" placeholder="새 자산 종류 이름 입력" value={regForm.customItemTypeName} onChange={(e) => handleRegChange('customItemTypeName', e.target.value)} autoFocus />
                  <button className={styles.customTypeCancelBtn} onClick={() => handleRegChange('assetTypeId', '')} title="선택으로 돌아가기">✕</button>
                </div>
              ) : (
                <select className={styles.select} value={regForm.assetTypeId} onChange={(e) => handleRegChange('assetTypeId', e.target.value)}>
                  <option value="">선택</option>
                  {itemTypeOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                  {!regForm.isExisting && <option value="__custom__">직접 입력</option>}
                </select>
              )}
            </div>

            {/* 두산 번호 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>두산 번호</label>
              <input className={styles.input} type="text" placeholder="두산 번호 입력" value={regForm.doosanItemNumber} onChange={(e) => handleRegChange('doosanItemNumber', e.target.value)} />
            </div>

            {/* 자산명 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>자산명 {!regForm.isExisting && <span className={styles.required}>*</span>}</label>
              {regForm.isExisting ? (
                regForm.modelName === '__custom__' ? (
                  <div className={styles.customTypeWrap}>
                    <input className={styles.input} type="text" placeholder="자산명 직접 입력" value={regForm.customModelName} onChange={(e) => handleRegChange('customModelName', e.target.value)} autoFocus />
                    <button className={styles.customTypeCancelBtn} onClick={() => handleRegChange('modelName', '')} title="선택으로 돌아가기">✕</button>
                  </div>
                ) : (
                  <select className={styles.select} value={regForm.modelName} onChange={(e) => handleRegChange('modelName', e.target.value)}>
                    <option value="">선택</option>
                    {modelNameOptions.map((name) => (<option key={name} value={name}>{name}</option>))}
                    <option value="__custom__">직접 입력</option>
                  </select>
                )
              ) : (
                <input className={styles.input} type="text" placeholder="모델명 입력" value={regForm.modelName} onChange={(e) => handleRegChange('modelName', e.target.value)} />
              )}
            </div>

            {/* 제조사 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>제조사 {!regForm.isExisting && <span className={styles.required}>*</span>}</label>
              {regForm.isExisting ? (
                regForm.manufacturer === '__custom__' ? (
                  <div className={styles.customTypeWrap}>
                    <input className={styles.input} type="text" placeholder="제조사 직접 입력" value={regForm.customManufacturer} onChange={(e) => handleRegChange('customManufacturer', e.target.value)} autoFocus />
                    <button className={styles.customTypeCancelBtn} onClick={() => handleRegChange('manufacturer', '')} title="선택으로 돌아가기">✕</button>
                  </div>
                ) : (
                  <select className={styles.select} value={regForm.manufacturer} onChange={(e) => handleRegChange('manufacturer', e.target.value)}>
                    <option value="">선택</option>
                    {manufacturerOptions.map((m) => (<option key={m} value={m}>{m}</option>))}
                    <option value="__custom__">직접 입력</option>
                  </select>
                )
              ) : (
                <input className={styles.input} type="text" placeholder="제조사 입력" value={regForm.manufacturer} onChange={(e) => handleRegChange('manufacturer', e.target.value)} />
              )}
            </div>

            {/* 시리얼 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>시리얼 번호</label>
              <input className={styles.input} type="text" placeholder="시리얼 번호 입력" value={regForm.serialNumber} onChange={(e) => handleRegChange('serialNumber', e.target.value)} />
            </div>

            {/* 규격 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>규격</label>
              <input className={styles.input} type="text" placeholder="규격 입력" value={regForm.spec} onChange={(e) => handleRegChange('spec', e.target.value)} />
            </div>

            {/* 수량 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>수량 <span className={styles.required}>*</span></label>
              <input className={styles.input} type="number" placeholder="0" min="1" value={regForm.quantity} onChange={(e) => handleRegChange('quantity', e.target.value)} />
            </div>

            {/* 수량 단위 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>수량 단위</label>
              <select className={styles.select} value={regForm.quantityUnit} onChange={(e) => handleRegChange('quantityUnit', e.target.value)}>
                {UNIT_OPTIONS.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>

            {/* 등록일 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>등록일 <span className={styles.required}>*</span></label>
              <input className={styles.input} type="date" value={regForm.rentalStartDate} onChange={(e) => handleRegChange('rentalStartDate', e.target.value)} />
            </div>

            {/* 반납일 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>반납일</label>
              <input className={styles.input} type="date" value={regForm.rentalEndDate} onChange={(e) => handleRegChange('rentalEndDate', e.target.value)} />
            </div>

            {/* 위치 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>위치</label>
              <input className={styles.input} type="text" placeholder="위치 입력" value={regForm.location} onChange={(e) => handleRegChange('location', e.target.value)} />
            </div>

            {/* 비고 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>비고</label>
              <input className={styles.input} type="text" placeholder="비고 입력" value={regForm.remarks} onChange={(e) => handleRegChange('remarks', e.target.value)} />
            </div>
          </div>

          <div className={styles.formActions}>
            <button className={styles.resetBtn} onClick={() => setShowResetConfirm(true)}>초기화</button>
            <button className={styles.submitBtn} onClick={handleRegSubmit} disabled={registerMutation.isPending}>
              {registerMutation.isPending ? '등록 중...' : '등록'}
            </button>
          </div>
        </Card>
      </section>

      {/* ════ DF 자산 조회 섹션 ════════════════════════════════════════════ */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Search size={15} />
          <span>DF 자산 조회</span>
        </div>

        {/* 프로젝트 요약 카드 */}
        <div className={styles.projCards}>
          <div
            className={`${styles.projCard} ${styles.projCardTotal} ${appliedFilters.projectId === '' ? styles.projCardActive : ''}`}
            onClick={handleCardAllClick}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleCardAllClick()}
          >
            <div className={styles.projCardTitle}>전체 프로젝트</div>
            <div className={styles.projCardCount}>
              {(baseData ?? filteredData)?.rows?.length ?? 0}<span className={styles.projCardUnit}> 건</span>
            </div>
          </div>
          {projectSummaries.map((proj) => (
            <div
              key={proj.id}
              className={`${styles.projCard} ${appliedFilters.projectId === String(proj.id) ? styles.projCardActive : ''}`}
              onClick={() => handleCardClick(proj.id)}
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleCardClick(proj.id)}
            >
              <div className={styles.projCardTitle}>{proj.name}</div>
              <div className={styles.projCardCount}>
                {proj.count}<span className={styles.projCardUnit}> 건</span>
              </div>
            </div>
          ))}
        </div>

        {/* 자산 테이블 카드 */}
        <Card>
          {/* 필터 영역 */}
          <div className={styles.filterArea}>
            <select className={styles.filterSelect} value={filterForm.projectId} onChange={(e) => handleFilterChange('projectId', e.target.value)}>
              <option value="">전체 프로젝트</option>
              {projectSummaries.map((proj) => (<option key={proj.id} value={proj.id}>{proj.name}</option>))}
            </select>
            <select className={styles.filterSelect} value={filterForm.itemTypeId} onChange={(e) => handleFilterChange('itemTypeId', e.target.value)}>
              <option value="">자산 종류 전체</option>
              {itemTypeOptions.map((opt) => (<option key={opt.id} value={opt.id}>{opt.name}</option>))}
            </select>
            <select className={styles.filterSelect} value={filterForm.manufacturer} onChange={(e) => handleFilterChange('manufacturer', e.target.value)}>
              <option value="">제조사 전체</option>
              {manufacturerOptions.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
            <select className={styles.filterSelect} value={filterForm.state} onChange={(e) => handleFilterChange('state', e.target.value)}>
              <option value="">자산 상태 전체</option>
              {STATE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
            <button className={styles.filterResetBtn} onClick={handleFilterReset}>초기화</button>
            <div className={styles.filterSearchWrap}>
              <input type="text" className={styles.filterInput} placeholder="검색어를 입력하세요" value={filterForm.keyword} onChange={(e) => handleFilterChange('keyword', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              <button className={styles.filterSearchBtn} onClick={handleSearch}><Search size={14} /></button>
            </div>
          </div>

          {/* 반납 모드 비고 */}
          {returnMode && (
            <div className={styles.modeArea}>
              <label className={styles.modeAreaLabel}>비고</label>
              <input className={styles.modeAreaInput} type="text" placeholder="반납 사유 또는 메모를 입력하세요 (선택)" value={returnRemarks} onChange={(e) => setReturnRemarks(e.target.value)} />
            </div>
          )}

          {/* 이동 모드 위치 */}
          {moveMode && (
            <div className={styles.modeArea}>
              <label className={styles.modeAreaLabel}>이동 위치</label>
              <input className={styles.modeAreaInput} type="text" placeholder="이동할 위치를 입력하세요" value={moveLocation} onChange={(e) => setMoveLocation(e.target.value)} autoFocus />
            </div>
          )}

          {/* ── 액션 버튼 영역 ── */}
          <div className={styles.tableActions}>
            {/* Import / Export — 좌측 */}
            <div className={styles.tableActionsLeft}>
              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={handleFileChange}
              />
              <button
                className={styles.importBtn}
                onClick={handleImportClick}
                disabled={importMutation.isPending || isBusy}
                title="엑셀 파일을 업로드하여 DF 자산을 일괄 등록합니다"
              >
                {importMutation.isPending ? 'Import 중...' : '⬆ Import'}
              </button>
              <button
                className={styles.exportBtn}
                onClick={handleExport}
                disabled={isExporting || isBusy}
                title="현재 필터 조건으로 엑셀 파일을 다운로드합니다"
              >
                {isExporting ? 'Export 중...' : '⬇ Export'}
              </button>
            </div>

            {/* 이동 / 반납 — 우측 */}
            <div className={styles.tableActionsRight}>
              {moveMode ? (
                <>
                  <button className={styles.moveCancelBtn} onClick={cancelMoveMode}>취소</button>
                  <button className={styles.moveSaveBtn} onClick={handleMoveSaveClick} disabled={moveMutation.isPending}>저장</button>
                </>
              ) : (
                <button className={styles.moveBtn} onClick={handleMoveClick} disabled={returnMode}>자산 이동</button>
              )}
              {returnMode ? (
                <>
                  <button className={styles.returnCancelBtn} onClick={cancelReturnMode}>취소</button>
                  <button className={styles.returnConfirmBtn} onClick={handleReturnConfirmClick} disabled={returnMutation.isPending}>반납 확인</button>
                </>
              ) : (
                <button className={styles.returnBtn} onClick={handleReturnClick} disabled={moveMode}>반납</button>
              )}
            </div>
          </div>

          {isLoading && <div className={styles.stateMsg}>데이터를 불러오는 중...</div>}
          {isError   && <div className={`${styles.stateMsg} ${styles.errorMsg}`}>데이터 조회에 실패했습니다.</div>}

          {!isLoading && !isError && (
            <>
              <DataTable
                columns={DF_COLUMNS}
                rows={paginatedRows}
                statusMap={DF_STATUS_MAP}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                totalCount={totalCount}
                highlight={appliedFilters.keyword}
              />
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button className={styles.pageBtn} disabled={safePage === 1} onClick={() => handlePageChange(safePage - 1)} aria-label="이전 페이지">‹</button>
                  {pageNumbers[0] > 1 && (
                    <>
                      <button className={styles.pageBtn} onClick={() => handlePageChange(1)}>1</button>
                      {pageNumbers[0] > 2 && <span className={styles.pageDots}>…</span>}
                    </>
                  )}
                  {pageNumbers.map((p) => (
                    <button key={p} className={`${styles.pageBtn} ${safePage === p ? styles.pageBtnActive : ''}`} onClick={() => handlePageChange(p)}>{p}</button>
                  ))}
                  {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className={styles.pageDots}>…</span>}
                      <button className={styles.pageBtn} onClick={() => handlePageChange(totalPages)}>{totalPages}</button>
                    </>
                  )}
                  <button className={styles.pageBtn} disabled={safePage === totalPages} onClick={() => handlePageChange(safePage + 1)} aria-label="다음 페이지">›</button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      {/* ── 모달 ── */}
      <ConfirmModal isOpen={showNoSelectModal} title="자산을 선택해주세요." desc="반납 또는 이동할 자산을 먼저 선택해주세요." confirmLabel="확인" confirmVariant="primary" onConfirm={() => setShowNoSelectModal(false)} onCancel={() => setShowNoSelectModal(false)} />
      <ConfirmModal isOpen={showMoveConfirm} title={`선택한 자산 ${selectedIds.length}개를 이동할까요?`} desc={`이동 위치: ${moveLocation}`} confirmLabel="이동" confirmVariant="primary" onConfirm={handleMoveConfirm} onCancel={() => setShowMoveConfirm(false)} />
      <ConfirmModal isOpen={showReturnConfirm} title={`선택한 자산 ${selectedIds.length}개를 반납할까요?`} desc="반납된 자산은 목록에서 제외됩니다." confirmLabel="반납" confirmVariant="danger" onConfirm={handleReturnConfirm} onCancel={() => setShowReturnConfirm(false)} />
      <ConfirmModal isOpen={showRegConfirm} title="DF 자산을 등록할까요?" desc="입력한 내용으로 DF 자산이 즉시 등록됩니다." confirmLabel="등록" confirmVariant="primary" onConfirm={handleRegConfirm} onCancel={() => setShowRegConfirm(false)} />
      <ConfirmModal isOpen={showResetConfirm} title="입력 내용을 초기화할까요?" desc="작성한 모든 항목이 삭제됩니다." confirmLabel="초기화" confirmVariant="danger" onConfirm={() => { setRegForm(EMPTY_REG_FORM); setShowResetConfirm(false) }} onCancel={() => setShowResetConfirm(false)} />
    </div>
  )
}

export default AdminDfAssetsPage