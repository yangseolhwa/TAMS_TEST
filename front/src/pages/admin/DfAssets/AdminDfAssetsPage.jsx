.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* =====================
   섹션
   ===================== */
.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sectionHeader {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

/* =====================
   자산 종류 직접 입력
   ===================== */
.customTypeWrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.customTypeWrap .input {
  flex: 1;
}

.customTypeCancelBtn {
  flex-shrink: 0;
  width: 32px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.customTypeCancelBtn:hover {
  background-color: var(--color-error-ring);
  border-color: var(--color-error-border);
  color: var(--color-error);
}

/* =====================
   기존 / 신규 라디오
   ===================== */
.radioRow {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}

.radioLabel {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
}

.radioLabel input[type='radio'] {
  accent-color: var(--color-accent);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

/* =====================
   등록 폼 그리드 (3열)
   ===================== */
.formGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px 16px;
}

.formGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.required {
  color: var(--color-error);
  margin-left: 2px;
}

.input {
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.input::placeholder {
  color: var(--color-border);
}

.input[type='number']::-webkit-inner-spin-button,
.input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.select {
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23718096' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

/* =====================
   폼 액션 버튼
   ===================== */
.formActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.resetBtn {
  height: 38px;
  padding: 0 20px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-secondary);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.resetBtn:hover {
  background-color: var(--color-bg);
}

.submitBtn {
  height: 38px;
  padding: 0 24px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background-color: var(--color-submit);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
}

.submitBtn:hover:not(:disabled) {
  background-color: var(--color-submit-hover);
}

.submitBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =====================
   프로젝트 요약 카드
   ===================== */
.projCards {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.projCard {
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: 14px 22px;
  min-width: 120px;
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.projCard:hover {
  border-color: var(--color-primary-border);
  background-color: var(--color-primary-tint);
}

.projCardTotal {
  background-color: var(--color-primary-tint);
  border-color: var(--color-primary-border);
}

.projCardActive {
  background-color: var(--color-primary) !important;
  border-color: var(--color-primary) !important;
  box-shadow: 0 4px 12px rgba(30, 45, 69, 0.2);
}

.projCardActive .projCardTitle,
.projCardActive .projCardCount {
  color: #fff !important;
}

.projCardTitle {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.projCardTotal .projCardTitle {
  color: var(--color-primary);
}

.projCardCount {
  font-size: 22px;
  font-weight: 900;
  margin-top: 4px;
  color: var(--color-text-secondary);
}

.projCardTotal .projCardCount {
  color: var(--color-primary);
}

.projCardUnit {
  font-size: 13px;
  font-weight: 600;
}

/* =====================
   필터 영역
   ===================== */
.filterArea {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.filterSelect {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  outline: none;
  transition: border-color var(--transition-fast);
}

.filterSelect:hover { border-color: var(--color-border); }
.filterSelect:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.filterResetBtn {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--color-primary-border);
  border-radius: var(--radius-md);
  background: var(--color-primary-tint);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--transition-fast);
}

.filterResetBtn:hover {
  background: var(--color-primary-tint-hover);
  border-color: var(--color-primary-border-hover);
}

.filterSearchWrap {
  display: flex;
  align-items: center;
  margin-left: auto;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.filterSearchWrap:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.filterInput {
  width: 220px;
  height: 36px;
  padding: 0 12px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  font-family: var(--font-sans);
  outline: none;
}

.filterInput::placeholder { color: var(--color-text-secondary); }

.filterSearchBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-left: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}

.filterSearchBtn:hover {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

/* =====================
   반납/이동 모드 공통 입력 영역
   ===================== */
.modeArea {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px 14px;
  background-color: var(--color-accent-bg);
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-md);
}

.modeAreaLabel {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.modeAreaInput {
  flex: 1;
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.modeAreaInput:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.modeAreaInput::placeholder {
  color: var(--color-text-secondary);
}

/* 이동 모드 버튼 */
.moveSaveBtn {
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background-color: var(--color-submit);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
  white-space: nowrap;
}

.moveSaveBtn:hover:not(:disabled) { background-color: var(--color-submit-hover); }
.moveSaveBtn:disabled { opacity: 0.6; cursor: not-allowed; }

.moveCancelBtn {
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-secondary);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.moveCancelBtn:hover { background-color: var(--color-bg); }

/* 반납 모드 버튼 */
.returnConfirmBtn {
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background-color: var(--color-error);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
  white-space: nowrap;
}

.returnConfirmBtn:hover:not(:disabled) { background-color: var(--color-error-hover); }
.returnConfirmBtn:disabled { opacity: 0.6; cursor: not-allowed; }

.returnCancelBtn {
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-secondary);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.returnCancelBtn:hover { background-color: var(--color-bg); }

/* =====================
   테이블 액션 버튼
   ===================== */
.tableActions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.returnBtn,
.moveBtn {
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
}

.returnBtn { background-color: var(--color-error); }
.returnBtn:hover:not(:disabled) { background-color: var(--color-error-hover); }

.moveBtn { background-color: var(--color-submit); }
.moveBtn:hover:not(:disabled) { background-color: var(--color-submit-hover); }

.returnBtn:disabled,
.moveBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* =====================
   상태 메시지
   ===================== */
.stateMsg {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.errorMsg { color: var(--color-error); }

/* =====================
   페이지네이션
   ===================== */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding-top: 16px;
}

.pageBtn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  color: var(--color-text-secondary);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: 6px;
  cursor: pointer;
  line-height: 1;
  transition: background-color var(--transition-fast), color var(--transition-fast),
    border-color var(--transition-fast);
}

.pageBtn:hover:not(:disabled) {
  background-color: var(--color-accent-bg);
  color: var(--color-accent);
  border-color: var(--color-accent-border);
}

.pageBtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pageBtnActive {
  background-color: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
  font-weight: 700;
}

.pageBtnActive:hover:not(:disabled) {
  background-color: var(--color-primary);
  color: #fff;
}

.pageDots {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: 0 4px;
  user-select: none;
}