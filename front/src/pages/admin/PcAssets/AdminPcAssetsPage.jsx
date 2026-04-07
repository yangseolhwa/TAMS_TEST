import { useState } from "react";
import { Search } from "react-bootstrap-icons";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import PageHeader from "../../../components/PageHeader/PageHeader";
import ActionButton from "../../../components/ActionButton/ActionButton";
import BackButton from "../../../components/BackButton/BackButton";
import common from "../AssetPage.common.module.css";
import styles from "./AdminPcAssetsPage.module.css";

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const PC_COLUMNS = [
  { key: "no",           label: "No" },
  { key: "assetNumber",  label: "자산번호",    type: "dash" },
  { key: "acquiredAt",   label: "취득일자",    type: "dash" },
  { key: "assetType",    label: "자산종류",    type: "dash" },
  { key: "modelName",    label: "모델명",      type: "dash" },
  { key: "manufacturer", label: "제조사",      type: "dash" },
  { key: "spec",         label: "규격",        type: "dash" },
  { key: "serialNumber", label: "시리얼 넘버", type: "dash" },
  { key: "location",     label: "위치",        type: "dash" },
  { key: "remarks",      label: "비고",        type: "dash" },
];

// API 연동 시 대체 예정
const MOCK_PROJECT_OPTIONS = ["프로젝트 A", "프로젝트 B", "프로젝트 C"];
const MOCK_USER_OPTIONS    = ["김철수", "이영희", "박민준"];
const MOCK_MFR_OPTIONS     = ["Samsung", "LG", "Dell", "Apple"];
const MOCK_LOC_OPTIONS     = ["서울 본사", "부산 지사", "창고"];
const MOCK_STATE_OPTIONS   = [
  { value: "active",   label: "사용중" },
  { value: "inactive", label: "미사용" },
  { value: "stored",   label: "보관중" },
];

const EMPTY_FILTER = {
  project:  "",
  user:     "",
  mfr:      "",
  location: "",
  state:    "",
  keyword:  "",
};

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
const AdminPcAssetsPage = () => {
  const [selectedIds,    setSelectedIds]    = useState([]);
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER);

  // null | 'stateChange' | 'move' | 'return'
  const [activeMode, setActiveMode] = useState(null);

  const handleFilterChange = (key, value) => {
    setFilterForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER);
    setAppliedFilters(EMPTY_FILTER);
  };

  const handleSearch = () => {
    setAppliedFilters(filterForm);
  };

  const handleModeEnter = (mode) => {
    setSelectedIds([]);
    setActiveMode(mode);
  };

  const handleModeCancel = () => {
    setSelectedIds([]);
    setActiveMode(null);
  };

  // API 연동 시 기능 추가 예정
  const handleModeConfirm = () => {
    setSelectedIds([]);
    setActiveMode(null);
  };

  return (
    <div className={common.page}>
      <PageHeader title="PC 전체 조회"
        desc={<BackButton label="내 자산 관리" to="/admin/my-assets" />} />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.project}
              onChange={(e) => handleFilterChange("project", e.target.value)}
            >
              <option value="">전체 프로젝트</option>
              {MOCK_PROJECT_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.user}
              onChange={(e) => handleFilterChange("user", e.target.value)}
            >
              <option value="">사용자</option>
              {MOCK_USER_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.mfr}
              onChange={(e) => handleFilterChange("mfr", e.target.value)}
            >
              <option value="">제조사 전체</option>
              {MOCK_MFR_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.location}
              onChange={(e) => handleFilterChange("location", e.target.value)}
            >
              <option value="">위치 전체</option>
              {MOCK_LOC_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              className={common.filterSelect}
              value={filterForm.state}
              onChange={(e) => handleFilterChange("state", e.target.value)}
            >
              <option value="">자산 상태 전체</option>
              {MOCK_STATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <ActionButton
              variant="white"
              size="sm"
              label="초기화"
              onClick={handleFilterReset}
            />

            <div className={common.filterSearchWrap}>
              <input
                type="text"
                className={common.filterInput}
                placeholder="검색어를 입력하세요"
                value={filterForm.keyword}
                onChange={(e) => handleFilterChange("keyword", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
                <ActionButton variant="black" size="sm" label="상태 변경" onClick={() => handleModeEnter("stateChange")} />
                <ActionButton variant="blue"  size="sm" label="자산 이동" onClick={() => handleModeEnter("move")} />
                <ActionButton variant="red"   size="sm" label="반납"      onClick={() => handleModeEnter("return")} />
              </>
            ) : (
              <>
                <ActionButton variant="white" size="sm" label="취소" onClick={handleModeCancel} />
                {activeMode === "stateChange" && <ActionButton variant="black" size="sm" label="저장" onClick={handleModeConfirm} />}
                {activeMode === "move"        && <ActionButton variant="blue"  size="sm" label="저장"    onClick={handleModeConfirm} />}
                {activeMode === "return"      && <ActionButton variant="red"   size="sm" label="확인"    onClick={handleModeConfirm} />}
              </>
            )}
          </div>

          <DataTable
            columns={PC_COLUMNS}
            rows={[]}
            statusMap={{}}
            selectable={activeMode !== null}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalCount={0}
            highlight={appliedFilters.keyword}
          />
        </Card>
      </section>
    </div>
  );
};

export default AdminPcAssetsPage;
