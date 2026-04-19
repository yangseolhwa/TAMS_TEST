import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import Card from '../../components/Card/Card'
import PageHeader from '../../components/PageHeader/PageHeader'
import ActionButton from '../../components/ActionButton/ActionButton'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import {
  fetchDfDashboard,
  registerDfAsset,
  importDfAssets,
  downloadDfTemplate,
} from '../../services/assetService'
import common from '../AssetPage.common.module.css'
import styles from './DfAssetsRegisterPage.module.css'

// ── 필수 항목 키 목록 ─────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['projectId', 'assetTypeId', 'manufacturer', 'modelName', 'acquisitionDate']

// 호출 시마다 오늘 날짜로 새 객체 생성
const createEmptyForm = () => ({
  projectId:       '',
  ownerOrg:        '',
  equipmentNumber: '',
  assetTypeId:     '',
  modelName:       '',
  manufacturer:    '',
  spec:            '',
  serialNumber:    '',
  acquisitionDate: new Date().toISOString().slice(0, 10),
  returnDate:      '',
  location:        '장비실',
  remarks:         '',
})
// ─────────────────────────────────────────────────────────────────────────────

const DfAssetsRegisterPage = ({ role }) => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const [form,       setForm]       = useState(createEmptyForm)
  const [errors,     setErrors]     = useState({})
  const [resetModal, setResetModal] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // ── 대시보드에서 프로젝트 / 자산 종류 옵션 ────────────────────────────────
  const { data: dashboard } = useQuery({
    queryKey: ['dfDashboard'],
    queryFn:  fetchDfDashboard,
    refetchOnWindowFocus: false,
  })
  const projectOptions = dashboard?.projectOptions ?? []
  const typeOptions    = dashboard?.typeOptions    ?? []

  // ── 폼 핸들러 ─────────────────────────────────────────────────────────────
  const handleChange = (key, value) => {
    setErrors((prev) => ({ ...prev, [key]: false }))
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleReset = () => setResetModal(true)

  const handleResetConfirm = () => {
    setForm(createEmptyForm())
    setErrors({})
    setResetModal(false)
  }

  const validate = () => {
    const newErrors = {}
    REQUIRED_FIELDS.forEach((key) => {
      if (!form[key]) newErrors[key] = true
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── 등록 Mutation ─────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: () => registerDfAsset({
      project_id: Number(form.projectId),
      items: [{
        asset_type_id:      Number(form.assetTypeId),
        manufacturer:       form.manufacturer.trim(),
        model_name:         form.modelName.trim(),
        acquisition_date:   form.acquisitionDate,
        ...(form.ownerOrg.trim()        && { owner_organization: form.ownerOrg.trim() }),
        ...(form.equipmentNumber.trim() && { equipment_number:   form.equipmentNumber.trim() }),
        ...(form.spec.trim()            && { spec:               form.spec.trim() }),
        ...(form.serialNumber.trim()    && { serial_number:      form.serialNumber.trim() }),
        ...(form.returnDate             && { return_date:        form.returnDate }),
        ...(form.location.trim()        && { location:           form.location.trim() }),
        ...(form.remarks.trim()         && { remarks:            form.remarks.trim() }),
      }],
    }),
    onSuccess: (res) => {
      toast.success(res?.message ?? 'DF 자산이 등록되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['dfAssets'] })
      queryClient.invalidateQueries({ queryKey: ['dfDashboard'] })
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
    try {
      await downloadDfTemplate()
    } catch (err) {
      toast.error(err.message)
    }
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
        title="DF 자산 등록"
        desc="DF 장비의 등록, 조회 및 위치 변동을 수행합니다."
      />

      <section className={common.section}>
        <Card>

          {/* 카드 상단: 엑셀 관련 버튼 */}
          <div className={styles.cardHeader}>
            <button
              type="button"
              className={styles.templateBtn}
              onClick={handleTemplateDownload}
              disabled={isPending}
            >
              <Download size={13} />
              양식 다운로드
            </button>
            <button
              type="button"
              className={styles.importBtn}
              onClick={() => fileInputRef.current.click()}
              disabled={isPending}
            >
              <Upload size={13} />
              {isImporting ? '업로드 중...' : '엑셀 업로드'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className={styles.hiddenFileInput}
              onChange={handleImport}
            />
          </div>

          {/* 폼 그리드 */}
          <fieldset
            disabled={isPending}
            style={{ border: 'none', padding: 0, margin: 0 }}
          >
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
                <input
                  className={styles.input}
                  type="text"
                  placeholder="소유기관 입력"
                  value={form.ownerOrg}
                  onChange={(e) => handleChange('ownerOrg', e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>장비번호</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="장비번호 입력"
                  value={form.equipmentNumber}
                  onChange={(e) => handleChange('equipmentNumber', e.target.value)}
                />
              </div>

              {/* Row 2: 자산 종류 / 모델명 / 제조사 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  자산 종류 <span className={styles.required}>*</span>
                </label>
                <select
                  className={`${styles.select} ${errors.assetTypeId ? styles.errorField : ''}`}
                  value={form.assetTypeId}
                  onChange={(e) => handleChange('assetTypeId', e.target.value)}
                >
                  <option value="">선택</option>
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {errors.assetTypeId && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  모델명 <span className={styles.required}>*</span>
                </label>
                <input
                  className={`${styles.input} ${errors.modelName ? styles.errorField : ''}`}
                  type="text"
                  placeholder="모델명 입력"
                  value={form.modelName}
                  onChange={(e) => handleChange('modelName', e.target.value)}
                />
                {errors.modelName && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  제조사 <span className={styles.required}>*</span>
                </label>
                <input
                  className={`${styles.input} ${errors.manufacturer ? styles.errorField : ''}`}
                  type="text"
                  placeholder="제조사 입력"
                  value={form.manufacturer}
                  onChange={(e) => handleChange('manufacturer', e.target.value)}
                />
                {errors.manufacturer && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              {/* Row 3: 규격 / 시리얼 번호 / 취득일 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>규격</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="규격 입력"
                  value={form.spec}
                  onChange={(e) => handleChange('spec', e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>시리얼 번호</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="시리얼 번호 입력"
                  value={form.serialNumber}
                  onChange={(e) => handleChange('serialNumber', e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  취득일 <span className={styles.required}>*</span>
                </label>
                <input
                  className={`${styles.input} ${errors.acquisitionDate ? styles.errorField : ''}`}
                  type="date"
                  value={form.acquisitionDate}
                  onChange={(e) => handleChange('acquisitionDate', e.target.value)}
                />
                {errors.acquisitionDate && <span className={styles.errorMsg}>필수 항목입니다.</span>}
              </div>

              {/* Row 4: 반납일 / 자산 위치 */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>반납일</label>
                <input
                  className={styles.input}
                  type="date"
                  value={form.returnDate}
                  onChange={(e) => handleChange('returnDate', e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>자산 위치</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="위치 입력"
                  value={form.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                />
              </div>

              {/* Row 5: 비고 (전체 너비) */}
              <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>비고</label>
                <textarea
                  className={styles.textarea}
                  placeholder="비고 입력"
                  value={form.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                />
              </div>

            </div>
          </fieldset>

          {/* 폼 하단 버튼 */}
          <div className={styles.formFooter}>
            <ActionButton
              variant="white"
              size="sm"
              label="초기화"
              onClick={handleReset}
              disabled={isPending}
            />
            <ActionButton
              variant="blue"
              size="sm"
              label={registerMutation.isPending ? '등록 중...' : '등록'}
              onClick={handleSubmit}
              disabled={isPending}
            />
          </div>

        </Card>
      </section>

      {/* 초기화 확인 모달 */}
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