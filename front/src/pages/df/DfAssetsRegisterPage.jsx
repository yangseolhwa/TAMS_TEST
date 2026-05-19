import { useRef, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Upload, XCircle } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import Card from '../../components/Card/Card'
import PageHeader from '../../components/PageHeader/PageHeader'
import ActionButton from '../../components/ActionButton/ActionButton'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import {
  fetchDfDashboard,
  fetchDfItemTypes,
  registerDfAsset,
  importDfAssets,
  downloadDfTemplate,
} from '../../services/assetService'
import common from '../AssetPage.common.module.css'
import styles from './DfAssetsRegisterPage.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────
// 직접 입력 선택값 접두사 — 값 형식: '__direct__{parentId}'
const DIRECT_PREFIX = '__direct__'

// ── 초기 폼 ───────────────────────────────────────────────────────────────────
const createEmptyForm = () => ({
  projectId:       '',
  ownerOrg:        '',
  equipmentNumber: '',
  assetTypeId:     '',   // 기존 중분류 id | '__direct__{parentId}'
  subTypeName:     '',   // 직접 입력 시 중분류명
  modelName:       '',
  manufacturer:    '',
  spec:            '',
  serialNumber:    '',
  quantity:        1,
  acquisitionDate: new Date().toISOString().slice(0, 10),
  returnDate:      '',
  location:        '장비실',
  remarks:         '',
})
// ─────────────────────────────────────────────────────────────────────────────

const DfAssetsRegisterPage = ({ role }) => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const [form,        setForm]        = useState(createEmptyForm)
  const [errors,      setErrors]      = useState({})
  const [resetModal,  setResetModal]  = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // ── 직접 입력 여부 & 파생 값 ──────────────────────────────────────────────
  const isDirect       = form.assetTypeId.startsWith(DIRECT_PREFIX)
  const directParentId = isDirect ? Number(form.assetTypeId.replace(DIRECT_PREFIX, '')) : null

  // ── 프로젝트 옵션 (대시보드) ───────────────────────────────────────────────
  const { data: dashboard } = useQuery({
    queryKey: ['dfDashboard'],
    queryFn:  fetchDfDashboard,
  })
  const projectOptions = dashboard?.projectOptions ?? []

  // ── 자산 종류 계층 ─────────────────────────────────────────────────────────
  const { data: typeGroups = [] } = useQuery({
    queryKey: ['dfItemTypes'],
    queryFn:  fetchDfItemTypes,
  })

  // ── 선택된 프로젝트의 대분류(PC/PLC) 기준 필터링 ──────────────────────────
  // 프로젝트에 저장된 typeIds로 어떤 대분류가 쓰이는지만 파악하고,
  // 해당 대분류의 전체 중분류를 표시 (프로젝트에 없는 종류도 선택 가능)
  const filteredTypeGroups = useMemo(() => {
    if (!form.projectId) return typeGroups
    const selectedProject = projectOptions.find((p) => p.id === Number(form.projectId))
    if (!selectedProject?.typeIds?.length) return typeGroups

    const usedTypeIds = new Set(selectedProject.typeIds)

    // 프로젝트에서 실제로 쓰이는 대분류 id 수집
    const usedParentIds = new Set()
    typeGroups.forEach((group) => {
      const hasMatchInProject = group.children.some((child) => usedTypeIds.has(child.id))
      if (hasMatchInProject) usedParentIds.add(group.id)
    })

    if (usedParentIds.size === 0) return typeGroups

    // 해당 대분류의 전체 중분류 노출 (필터 없음)
    return typeGroups.filter((group) => usedParentIds.has(group.id))
  }, [form.projectId, typeGroups, projectOptions])

  // ── 직접 입력 모드에서 표시할 대분류 이름 ─────────────────────────────────
  // (window 캐시 대신 filteredTypeGroups에서 직접 찾기)
  const resolvedParentName = useMemo(() => {
    if (!isDirect || directParentId == null) return ''
    return (
      filteredTypeGroups.find((g) => g.id === directParentId)?.name ??
      typeGroups.find((g) => g.id === directParentId)?.name ?? ''
    )
  }, [isDirect, directParentId, filteredTypeGroups, typeGroups])

  // ── 폼 핸들러 ─────────────────────────────────────────────────────────────
  const handleChange = (key, value) => {
    setErrors((prev) => ({ ...prev, [key]: false }))
    if (key === 'projectId') {
      // 프로젝트 변경 → 자산 종류 관련 전체 초기화
      setForm((prev) => ({ ...prev, projectId: value, assetTypeId: '', subTypeName: '' }))
    } else if (key === 'assetTypeId') {
      // 직접 입력 → 기존 선택 / 다른 직접 입력 전환 시 subTypeName 초기화
      setForm((prev) => ({ ...prev, assetTypeId: value, subTypeName: '' }))
    } else {
      setForm((prev) => ({ ...prev, [key]: value }))
    }
  }

  // 직접 입력 취소 → 셀렉트로 복귀
  const handleCancelDirect = () => {
    setForm((prev) => ({ ...prev, assetTypeId: '', subTypeName: '' }))
    setErrors((prev) => ({ ...prev, assetTypeId: false }))
  }

  const handleReset = () => setResetModal(true)

  const handleResetConfirm = () => {
    setForm(createEmptyForm())
    setErrors({})
    setResetModal(false)
  }

  // ── 유효성 검사 ───────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {}
    const baseFields = ['projectId', 'manufacturer', 'modelName', 'acquisitionDate']
    baseFields.forEach((key) => { if (!form[key]) newErrors[key] = true })

    // 자산 종류 별도 검증
    if (isDirect) {
      if (!form.subTypeName.trim()) newErrors.assetTypeId = true
    } else {
      if (!form.assetTypeId) newErrors.assetTypeId = true
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── 등록 Mutation ─────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: () => {
      // 자산 종류 body 분기
      const typePayload = isDirect
        ? { parent_type_id: directParentId, sub_type_name: form.subTypeName.trim() }
        : { asset_type_id: Number(form.assetTypeId) }

      return registerDfAsset({
        project_id: Number(form.projectId),
        items: [{
          ...typePayload,
          manufacturer:       form.manufacturer.trim(),
          model_number:       form.modelName.trim(),
          acquisition_date:   form.acquisitionDate,
          ...(form.ownerOrg.trim()        && { owner_organization: form.ownerOrg.trim() }),
          ...(form.equipmentNumber.trim() && { equipment_number:   form.equipmentNumber.trim() }),
          ...(form.spec.trim()            && { spec:               form.spec.trim() }),
          ...(form.serialNumber.trim()    && { serial_number:      form.serialNumber.trim() }),
          ...(form.quantity != null       && { quantity:           Number(form.quantity) }),
          ...(form.returnDate             && { return_date:        form.returnDate }),
          ...(form.location.trim()        && { location:           form.location.trim() }),
          ...(form.remarks.trim()         && { remarks:            form.remarks.trim() }),
        }],
      })
    },
    onSuccess: (res) => {
      toast.success(res?.message ?? 'DF 자산이 등록되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      queryClient.invalidateQueries({ queryKey: ['dfDashboard'] })
      // 직접 입력으로 새 중분류가 생성된 경우 목록 갱신
      if (isDirect) queryClient.invalidateQueries({ queryKey: ['dfItemTypes'] })
      setForm(createEmptyForm())
      setErrors({})
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = () => {
    if (!validate()) return
    registerMutation.mutate()
  }

  // ── 양식 다운로드 ─────────────────────────────────────────────────────────
  const handleTemplateDownload = async () => {
    try { await downloadDfTemplate() }
    catch (err) { toast.error(err.message) }
  }

  // ── 엑셀 업로드 ───────────────────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setIsImporting(true)
    try {
      const res = await importDfAssets(file)
      const { imported = 0, failed = 0 } = res
      if (failed === 0) {
        toast.success(res.message ?? `${imported}건이 등록되었습니다.`)
      } else {
        toast.error(`${imported}건 성공 / ${failed}건 실패. 실패 항목을 확인해주세요.`)
      }
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      queryClient.invalidateQueries({ queryKey: ['dfDashboard'] })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setIsImporting(false)
    }
  }

  const isPending = registerMutation.isPending || isImporting

  return (
    <div className={common.page}>
      <PageHeader
        title="DF 자산 등록" />

      <section>
        <Card>
          {/* 카드 상단: 엑셀 관련 버튼 */}
          <div className={styles.cardHeader}>
            <button type="button" className={styles.templateBtn}
              onClick={handleTemplateDownload} disabled={isPending}>
              <Download size={13} /> 양식 다운로드
            </button>
            <button type="button" className={styles.importBtn}
              onClick={() => fileInputRef.current.click()} disabled={isPending}>
              <Upload size={13} />
              {isImporting ? '업로드 중...' : '엑셀 업로드'}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
              className={styles.hiddenFileInput} onChange={handleImport} />
          </div>

          {/* 폼 그리드 */}
          <fieldset disabled={isPending} style={{ border: 'none', padding: 0, margin: 0 }}>
            <div className={styles.formGrid}>

              {/* Row 1: 프로젝트 / 소유기관 / 장비번호 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  프로젝트 <span className={styles.required}>*</span>
                </label>
                <select
                  className={`${styles.select} ${errors.projectId ? styles.errorField : ''}`}
                  value={form.projectId}
                  onChange={(e) => handleChange('projectId', e.target.value)}
                >
                  <option value="">선택</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {errors.projectId && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>소유기관</label>
                <input className={styles.input} type="text" placeholder="소유기관 입력"
                  value={form.ownerOrg} onChange={(e) => handleChange('ownerOrg', e.target.value)} />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>장비번호</label>
                <input className={styles.input} type="text" placeholder="장비번호 입력"
                  value={form.equipmentNumber} onChange={(e) => handleChange('equipmentNumber', e.target.value)} />
              </div>

              {/* Row 2: 자산 종류 / 모델명 / 제조사 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  자산 종류 <span className={styles.required}>*</span>
                </label>

                {/* 직접 입력 모드 */}
                {isDirect ? (
                  <div className={styles.directInputWrapper}>
                    <span className={styles.parentBadge}>{resolvedParentName}</span>
                    <input
                      className={`${styles.directInput} ${errors.assetTypeId ? styles.errorField : ''}`}
                      type="text"
                      placeholder="중분류명 입력 (예: CPU)"
                      autoFocus
                      value={form.subTypeName}
                      onChange={(e) => {
                        setErrors((prev) => ({ ...prev, assetTypeId: false }))
                        setForm((prev) => ({ ...prev, subTypeName: e.target.value }))
                      }}
                    />
                    <button
                      type="button"
                      className={styles.cancelDirectBtn}
                      onClick={handleCancelDirect}
                      title="직접 입력 취소"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                ) : (
                  /* 셀렉트 모드 */
                  <select
                    className={`${styles.select} ${errors.assetTypeId ? styles.errorField : ''}`}
                    value={form.assetTypeId}
                    onChange={(e) => handleChange('assetTypeId', e.target.value)}
                  >
                    <option value="">선택</option>
                    {filteredTypeGroups.map((group) => (
                      <optgroup key={group.id} label={group.name}>
                        {group.children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                        {/* 각 대분류 그룹 하단에 직접 입력 옵션 */}
                        <option value={`${DIRECT_PREFIX}${group.id}`}>
                          직접 입력...
                        </option>
                      </optgroup>
                    ))}
                  </select>
                )}

                {errors.assetTypeId && (
                  <span className={styles.errorMsg}>
                    {isDirect ? '중분류명을 입력해주세요.' : '필수 항목입니다.'}
                  </span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  모델명 <span className={styles.required}>*</span>
                </label>
                <input
                  className={`${styles.input} ${errors.modelName ? styles.errorField : ''}`}
                  type="text" placeholder="모델명 입력"
                  value={form.modelName} onChange={(e) => handleChange('modelName', e.target.value)}
                />
                {errors.modelName && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  제조사 <span className={styles.required}>*</span>
                </label>
                <input
                  className={`${styles.input} ${errors.manufacturer ? styles.errorField : ''}`}
                  type="text" placeholder="제조사 입력"
                  value={form.manufacturer} onChange={(e) => handleChange('manufacturer', e.target.value)}
                />
                {errors.manufacturer && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              {/* Row 3: 규격 / 시리얼 번호 / 수량 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>규격</label>
                <input className={styles.input} type="text" placeholder="규격 입력"
                  value={form.spec} onChange={(e) => handleChange('spec', e.target.value)} />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>시리얼 번호</label>
                <input className={styles.input} type="text" placeholder="시리얼 번호 입력"
                  value={form.serialNumber} onChange={(e) => handleChange('serialNumber', e.target.value)} />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>수량</label>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  placeholder="수량 입력"
                  value={form.quantity}
                  onChange={(e) => handleChange('quantity', e.target.value)}
                />
              </div>

              {/* Row 4: 대여일 / 반납일 / 자산 위치 */}

              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  대여일 <span className={styles.required}>*</span>
                </label>
                <input
                  className={`${styles.input} ${errors.acquisitionDate ? styles.errorField : ''}`}
                  type="date" value={form.acquisitionDate}
                  onChange={(e) => handleChange('acquisitionDate', e.target.value)}
                />
                {errors.acquisitionDate && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>반납일</label>
                <input className={styles.input} type="date" value={form.returnDate}
                  onChange={(e) => handleChange('returnDate', e.target.value)} />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>자산 위치</label>
                <input className={styles.input} type="text" placeholder="위치 입력"
                  value={form.location} onChange={(e) => handleChange('location', e.target.value)} />
              </div>

              {/* Row 5: 비고 (전체 너비) */}
              <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>비고</label>
                <textarea className={styles.textarea} placeholder="비고 입력"
                  value={form.remarks} onChange={(e) => handleChange('remarks', e.target.value)} />
              </div>

            </div>
          </fieldset>

          {/* 폼 하단 버튼 */}
          <div className={styles.formFooter}>
            <ActionButton variant="white" size="sm" label="초기화"
              onClick={handleReset} disabled={isPending} />
            <ActionButton variant="blue" size="sm"
              label={registerMutation.isPending ? '등록 중...' : '등록'}
              onClick={handleSubmit} disabled={isPending} />
          </div>

        </Card>
      </section>

      <ConfirmModal
        isOpen={resetModal}
        title="초기화 하시겠습니까?"
        desc="입력한 내용이 모두 초기화됩니다."
        confirmLabel="초기화"
        confirmVariant="danger"
        onConfirm={handleResetConfirm}
        onCancel={() => setResetModal(false)}
      />
    </div>
  )
}

export default DfAssetsRegisterPage