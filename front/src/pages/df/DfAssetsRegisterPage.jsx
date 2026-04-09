import { useRef, useState } from 'react'
import { Download, Upload } from 'react-bootstrap-icons'
import Card from '../../components/Card/Card'
import PageHeader from '../../components/PageHeader/PageHeader'
import ActionButton from '../../components/ActionButton/ActionButton'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import common from '../AssetPage.common.module.css'
import styles from './DfAssetsRegisterPage.module.css'

// ── 임시 목업 옵션 (API 연동 시 대체 예정) ────────────────────────────────
const MOCK_PROJECT_OPTIONS        = ['A 프로젝트', 'B 프로젝트', 'C 프로젝트']
const MOCK_OWNER_ORG_OPTIONS      = ['본사', '서울지사', '부산지사']
const MOCK_DEVICE_NUMBER_OPTIONS  = { '본사': ['본사-001', '본사-002'], '서울지사': ['서울-001'], '부산지사': ['부산-001'] }
const MOCK_MAJOR_CATEGORY_OPTIONS = ['서버/네트워크', 'PC/모바일', '주변기기']
const MOCK_MINOR_CATEGORY_OPTIONS = {
  '서버/네트워크': ['서버', '스위치', '라우터'],
  'PC/모바일':    ['노트북', '데스크탑', '태블릿'],
  '주변기기':     ['모니터', '키보드', '마우스'],
}
const MOCK_SPEC_OPTIONS = ['고사양', '중사양', '저사양']
// MOCK_MANUFACTURER_OPTIONS: API 연동 시 대체 예정

// ── 필수 항목 키 목록 ─────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['project', 'majorCategory', 'minorCategory', 'serialNumber', 'registeredAt']

// 호출 시마다 오늘 날짜로 새 객체 생성 (초기화 시 날짜 갱신을 위해 함수로 정의)
const createEmptyForm = () => ({
  project:       '',
  ownerOrg:      '',
  deviceNumber:  '',
  majorCategory: '',
  minorCategory: '',
  modelName:     '',
  spec:          '',
  manufacturer:  '',
  serialNumber:  '',
  registeredAt:  new Date().toISOString().slice(0, 10),
  returnedAt:    '',
  location:      '장비실',
  remarks:       '',
})
// ─────────────────────────────────────────────────────────────────────────────

const DfAssetsRegisterPage = ({ role }) => {
  const [form,        setForm]        = useState(createEmptyForm)
  const [errors,      setErrors]      = useState({})
  const [resetModal,  setResetModal]  = useState(false)
  const fileInputRef = useRef(null)

  const handleChange = (key, value) => {
    // 값 변경 시 해당 필드 에러 제거
    setErrors((prev) => ({ ...prev, [key]: false }))

    setForm((prev) => ({
      ...prev,
      [key]: value,
      // 소유기관 변경 시 장비번호 초기화
      ...(key === 'ownerOrg'      && { deviceNumber:  '' }),
      // 자산 대분류 변경 시 중분류 초기화
      ...(key === 'majorCategory' && { minorCategory: '' }),
    }))
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

  // API 연동 시 기능 추가 예정
  const handleSubmit = () => {
    if (!validate()) return
  }

  // API 연동 시 템플릿 파일 다운로드 기능 추가 예정
  const handleTemplateDownload = () => {}

  // API 연동 시 엑셀 파싱 후 DB 등록 기능 추가 예정
  // 성공/실패 시 toast 메시지 표시 예정
  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    alert(`"${file.name}" 파일을 임포트합니다. (API 연동 시 실제 등록 예정)`)
    e.target.value = ''
  }

  // 장비번호 옵션 (소유기관에 따라 동적)
  const deviceNumberOptions = MOCK_DEVICE_NUMBER_OPTIONS[form.ownerOrg] ?? []

  // 자산 중분류 옵션 (대분류에 따라 동적)
  const minorCategoryOptions = MOCK_MINOR_CATEGORY_OPTIONS[form.majorCategory] ?? []

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
            <button type="button" className={styles.templateBtn} onClick={handleTemplateDownload}>
              <Download size={13} />
              양식 다운로드
            </button>
            <button type="button" className={styles.importBtn} onClick={() => fileInputRef.current.click()}>
              <Upload size={13} />
              엑셀 업로드
            </button>
            {/* 실제 파일 입력 (숨김) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className={styles.hiddenFileInput}
              onChange={handleImport}
            />
          </div>

          {/* 폼 그리드 */}
          <div className={styles.formGrid}>

            {/* Row 1 */}
            <div className={styles.fieldGroup}>
              <label htmlFor="project" className={styles.label}>
                프로젝트 <span className={styles.required}>*</span>
              </label>
              <select
                id="project"
                className={`${styles.select} ${errors.project ? styles.errorField : ''}`}
                value={form.project}
                onChange={(e) => handleChange('project', e.target.value)}
              >
                <option value="">선택</option>
                {MOCK_PROJECT_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.project && <span className={styles.errorMsg}>필수 항목입니다.</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="ownerOrg" className={styles.label}>소유기관</label>
              <select
                id="ownerOrg"
                className={styles.select}
                value={form.ownerOrg}
                onChange={(e) => handleChange('ownerOrg', e.target.value)}
              >
                <option value="">없음</option>
                {MOCK_OWNER_ORG_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="deviceNumber" className={styles.label}>장비번호</label>
              <select
                id="deviceNumber"
                className={`${styles.select} ${errors.deviceNumber ? styles.errorField : ''}`}
                value={form.deviceNumber}
                onChange={(e) => handleChange('deviceNumber', e.target.value)}
                disabled={!form.ownerOrg}
              >
                <option value="">{form.ownerOrg ? '선택' : '소유기관 먼저 선택'}</option>
                {deviceNumberOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Row 2 */}
            <div className={styles.fieldGroup}>
              <label htmlFor="majorCategory" className={styles.label}>
                자산 대분류 <span className={styles.required}>*</span>
              </label>
              <select
                id="majorCategory"
                className={`${styles.select} ${errors.majorCategory ? styles.errorField : ''}`}
                value={form.majorCategory}
                onChange={(e) => handleChange('majorCategory', e.target.value)}
              >
                <option value="">선택</option>
                {MOCK_MAJOR_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.majorCategory && <span className={styles.errorMsg}>필수 항목입니다.</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="minorCategory" className={styles.label}>
                자산 중분류 <span className={styles.required}>*</span>
              </label>
              <select
                id="minorCategory"
                className={`${styles.select} ${errors.minorCategory ? styles.errorField : ''}`}
                value={form.minorCategory}
                onChange={(e) => handleChange('minorCategory', e.target.value)}
                disabled={!form.majorCategory}
              >
                <option value="">{form.majorCategory ? '선택' : '자산 대분류 먼저 선택'}</option>
                {minorCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.minorCategory && <span className={styles.errorMsg}>필수 항목입니다.</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="modelName" className={styles.label}>모델명</label>
              <input
                id="modelName"
                className={styles.input}
                type="text"
                placeholder="모델명 입력"
                value={form.modelName}
                onChange={(e) => handleChange('modelName', e.target.value)}
              />
            </div>

            {/* Row 3 */}
            <div className={styles.fieldGroup}>
              <label htmlFor="spec" className={styles.label}>규격</label>
              <select
                id="spec"
                className={styles.select}
                value={form.spec}
                onChange={(e) => handleChange('spec', e.target.value)}
              >
                <option value="">선택</option>
                {MOCK_SPEC_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              {/* API 연동 시 옵션 추가 예정 */}
              <label htmlFor="manufacturer" className={styles.label}>제조사</label>
              <select
                id="manufacturer"
                className={styles.select}
                value={form.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
              >
                <option value="">선택</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="serialNumber" className={styles.label}>
                시리얼 넘버 <span className={styles.required}>*</span>
              </label>
              <input
                id="serialNumber"
                className={`${styles.input} ${errors.serialNumber ? styles.errorField : ''}`}
                type="text"
                placeholder="시리얼 넘버 입력"
                value={form.serialNumber}
                onChange={(e) => handleChange('serialNumber', e.target.value)}
              />
              {errors.serialNumber && <span className={styles.errorMsg}>필수 항목입니다.</span>}
            </div>

            {/* Row 4 */}
            <div className={styles.fieldGroup}>
              <label htmlFor="registeredAt" className={styles.label}>
                등록일 <span className={styles.required}>*</span>
              </label>
              <input
                id="registeredAt"
                className={`${styles.input} ${errors.registeredAt ? styles.errorField : ''}`}
                type="date"
                value={form.registeredAt}
                onChange={(e) => handleChange('registeredAt', e.target.value)}
              />
              {errors.registeredAt && <span className={styles.errorMsg}>필수 항목입니다.</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="returnedAt" className={styles.label}>반납일</label>
              <input
                id="returnedAt"
                className={styles.input}
                type="date"
                value={form.returnedAt}
                onChange={(e) => handleChange('returnedAt', e.target.value)}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="location" className={styles.label}>자산 위치</label>
              <input
                id="location"
                className={styles.input}
                type="text"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
              />
            </div>

            {/* Row 5: 비고 (전체 너비) */}
            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
              <label htmlFor="remarks" className={styles.label}>비고</label>
              <textarea
                id="remarks"
                className={styles.textarea}
                placeholder="비고 입력"
                value={form.remarks}
                onChange={(e) => handleChange('remarks', e.target.value)}
              />
            </div>

          </div>

          {/* 폼 하단 버튼 */}
          <div className={styles.formFooter}>
            <ActionButton variant="white" size="sm" label="초기화" onClick={handleReset} />
            <ActionButton variant="blue"  size="sm" label="등록"   onClick={handleSubmit} />
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
