import { useState, useMemo } from "react";
import { Search } from "react-bootstrap-icons";
import PageHeader from "../../components/PageHeader/PageHeader";
import Card from "../../components/Card/Card";
import DataTable from "../../components/DataTable/DataTable";
import ActionButton from "../../components/ActionButton/ActionButton";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import common from "../AssetPage.common.module.css";
import styles from "./DfAssetsHistoryPage.module.css";

/**
 * [공통 설정]
 */

// API 연동 시 대체 예정
const MOCK_PROJECT_OPTIONS  = ["A 프로젝트", "B 프로젝트", "C 프로젝트"];
const MOCK_LOCATION_OPTIONS = ["서울 본사 1층", "서울 본사 2층", "부산 사무소"];

// API 연동 시 대체 예정
const MOCK_HISTORY = [
  { id: 1,  requestedAt: "2026-02-04", user: "admin", requestType: "등록",     prevLocation: null,         nextLocation: null,          prevState: null,    nextState: null,    projectName: "A 프로젝트", category: "노트북",  modelName: "LG Gram",        serialNumber: "032738" },
  { id: 2,  requestedAt: "2026-02-04", user: "admin", requestType: "등록",     prevLocation: null,         nextLocation: null,          prevState: null,    nextState: null,    projectName: "B 프로젝트", category: "데스크탑", modelName: "Dell XPS",       serialNumber: "032738" },
  { id: 3,  requestedAt: "2026-02-04", user: "admin", requestType: "이동",     prevLocation: "5층",         nextLocation: "6층",          prevState: null,    nextState: null,    projectName: "A 프로젝트", category: "노트북",  modelName: "MacBook Pro",    serialNumber: "032738" },
  { id: 4,  requestedAt: "2026-02-04", user: "admin", requestType: "반납",     prevLocation: null,         nextLocation: null,          prevState: null,    nextState: null,    projectName: "C 프로젝트", category: "모니터",  modelName: "LG 27UK850",     serialNumber: "032738" },
  { id: 5,  requestedAt: "2026-02-04", user: "admin", requestType: "등록",     prevLocation: null,         nextLocation: null,          prevState: null,    nextState: null,    projectName: "B 프로젝트", category: "노트북",  modelName: "ThinkPad X1",    serialNumber: "032738" },
  { id: 6,  requestedAt: "2026-02-04", user: "user",  requestType: "등록",     prevLocation: null,         nextLocation: null,          prevState: null,    nextState: null,    projectName: "A 프로젝트", category: "데스크탑", modelName: "HP EliteDesk",   serialNumber: "032738" },
  { id: 7,  requestedAt: "2026-02-04", user: "user",  requestType: "이동",     prevLocation: "서울 본사 1층", nextLocation: "서울 본사 2층", prevState: null,    nextState: null,    projectName: "C 프로젝트", category: "노트북",  modelName: "Dell Latitude",  serialNumber: "032738" },
  { id: 8,  requestedAt: "2026-02-04", user: "admin", requestType: "상태 변경", prevLocation: null,         nextLocation: null,          prevState: "보관중", nextState: "사용중", projectName: "A 프로젝트", category: "모니터",  modelName: "Samsung 32",     serialNumber: "032738" },
  { id: 9,  requestedAt: "2026-02-04", user: "user",  requestType: "이동",     prevLocation: "부산 사무소",  nextLocation: "서울 본사 1층", prevState: null,    nextState: null,    projectName: "B 프로젝트", category: "노트북",  modelName: "ASUS ZenBook",   serialNumber: "032738" },
  { id: 10, requestedAt: "2026-02-04", user: "admin", requestType: "반납",     prevLocation: null,         nextLocation: null,          prevState: null,    nextState: null,    projectName: "C 프로젝트", category: "데스크탑", modelName: "Lenovo IdeaPad", serialNumber: "032738" },
];

const REQUEST_TYPE_STYLE = {
  "등록":     styles.badgeRegister,
  "이동":     styles.badgeMove,
  "반납":     styles.badgeReturn,
  "상태 변경": styles.badgeStateChange,
};

const STATE_BADGE_STYLE = {
  "사용중": styles.stateActive,
  "보관중": styles.stateStored,
  "미사용": styles.stateInactive,
};

// 변경 전/후 셀 렌더링 헬퍼
const renderChangedCell = (requestType, locationVal, stateVal) => {
  if (requestType === "이동") {
    return locationVal
      ? <span>{locationVal}</span>
      : <span className={styles.dash}>-</span>;
  }
  if (requestType === "상태 변경") {
    return stateVal
      ? <span className={`${styles.badge} ${STATE_BADGE_STYLE[stateVal] ?? ""}`}>{stateVal}</span>
      : <span className={styles.dash}>-</span>;
  }
  return <span className={styles.dash}>-</span>;
};

const COLUMNS = [
  { key: "no",          label: "No" },
  { key: "requestedAt", label: "날짜" },
  { key: "user",        label: "사용자" },
  {
    key: "requestType",
    label: "요청",
    renderCell: (row) => (
      <span className={`${styles.badge} ${REQUEST_TYPE_STYLE[row.requestType] ?? ""}`}>
        {row.requestType}
      </span>
    ),
  },
  {
    key: "prevChange",
    label: "변경 전",
    renderCell: (row) => renderChangedCell(row.requestType, row.prevLocation, row.prevState),
  },
  {
    key: "nextChange",
    label: "변경 후",
    renderCell: (row) => renderChangedCell(row.requestType, row.nextLocation, row.nextState),
  },
  { key: "projectName",  label: "프로젝트",  renderCell: (row) => row.projectName  ?? <span className={styles.dash}>-</span> },
  { key: "category",     label: "자산 종류",  renderCell: (row) => row.category     ?? <span className={styles.dash}>-</span> },
  { key: "modelName",    label: "모델명",     renderCell: (row) => row.modelName    ?? <span className={styles.dash}>-</span> },
  { key: "serialNumber", label: "시리얼",     renderCell: (row) => row.serialNumber ?? <span className={styles.dash}>-</span> },
];

const EMPTY_FILTER = {
  projectName: "",
  user:        "",
  dateFrom:    "",
  dateTo:      "",
  location:    "",
  keyword:     "",
};

const DfAssetsHistoryPage = ({ role }) => {
  // --- [State: 필터] ---
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER);

  // --- [State: 삭제 모드] (admin 전용) ---
  const [isDeleteMode,      setIsDeleteMode]      = useState(false);
  const [selectedIds,       setSelectedIds]       = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- [필터 적용된 rows] ---
  const filteredRows = useMemo(() => {
    return MOCK_HISTORY.filter((row) => {
      if (appliedFilters.projectName && row.projectName !== appliedFilters.projectName) return false;
      if (appliedFilters.user        && row.user        !== appliedFilters.user)        return false;
      if (appliedFilters.dateFrom    && row.requestedAt <  appliedFilters.dateFrom)     return false;
      if (appliedFilters.dateTo      && row.requestedAt >  appliedFilters.dateTo)       return false;
      if (appliedFilters.location) {
        const loc = appliedFilters.location;
        if (row.prevLocation !== loc && row.nextLocation !== loc) return false;
      }
      if (appliedFilters.keyword) {
        const kw = appliedFilters.keyword.toLowerCase();
        const target = [row.user, row.projectName, row.category, row.modelName, row.serialNumber, row.prevLocation, row.nextLocation]
          .filter(Boolean).join(" ").toLowerCase();
        if (!target.includes(kw)) return false;
      }
      return true;
    }).map((row, i) => ({ ...row, no: i + 1 }));
  }, [appliedFilters]);

  // --- [Handlers: 필터] ---
  const handleFilterChange = (key, value) => {
    setFilterForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFilterReset = () => {
    setFilterForm(EMPTY_FILTER);
    setAppliedFilters(EMPTY_FILTER);
  };

  const handleSearch = () => setAppliedFilters(filterForm);

  // --- [Handlers: 삭제 모드] ---
  const handleDeleteModeEnter  = () => setIsDeleteMode(true);

  const handleDeleteModeCancel = () => {
    setIsDeleteMode(false);
    setSelectedIds([]);
  };

  // API 연동 시 구현 예정
  const handleDelete = () => {
    setShowDeleteConfirm(false);
    setIsDeleteMode(false);
    setSelectedIds([]);
  };

  return (
    <div className={common.page}>
      <PageHeader
        title="DF 자산 히스토리"
        desc="자산 이동, 상태 변경, 반납, 등록에 관한 모든 이력을 조회합니다."
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.projectName}
              onChange={(e) => handleFilterChange("projectName", e.target.value)}
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
              <option value="">사용자 구분</option>
              <option value="admin">admin</option>
              <option value="user">user</option>
            </select>

            <input
              type="date"
              className={styles.filterDate}
              value={filterForm.dateFrom}
              onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
            />
            <span className={styles.dateSeparator}>~</span>
            <input
              type="date"
              className={styles.filterDate}
              value={filterForm.dateTo}
              onChange={(e) => handleFilterChange("dateTo", e.target.value)}
            />

            <select
              className={common.filterSelect}
              value={filterForm.location}
              onChange={(e) => handleFilterChange("location", e.target.value)}
            >
              <option value="">위치 구분</option>
              {MOCK_LOCATION_OPTIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <ActionButton variant="white" size="sm" label="초기화" onClick={handleFilterReset} />

            {/* 검색 */}
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

          {/* 총 건수 + 삭제 버튼 영역 */}
          <div className={styles.tableHeader}>
            <span className={styles.totalCount}>
              총 {MOCK_HISTORY.length}건 중 {filteredRows.length}건 표시
            </span>

            {role === "admin" && (
              isDeleteMode ? (
                <>
                  <ActionButton variant="white" size="sm" label="취소" onClick={handleDeleteModeCancel} />
                  <ActionButton
                    variant="red"
                    size="sm"
                    label={`삭제 (${selectedIds.length})`}
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={selectedIds.length === 0}
                  />
                </>
              ) : (
                <ActionButton variant="red" size="sm" label="삭제" onClick={handleDeleteModeEnter} />
              )
            )}
          </div>

          <DataTable
            columns={COLUMNS}
            rows={filteredRows}
            selectable={isDeleteMode}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalCount={filteredRows.length}
          />
        </Card>
      </section>

      {/* 모달 모음 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title={`선택한 이력 ${selectedIds.length}건을 삭제할까요?`}
        desc="삭제된 이력은 복구할 수 없습니다."
        confirmLabel="삭제"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default DfAssetsHistoryPage;
