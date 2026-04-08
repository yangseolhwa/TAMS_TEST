import { useState, useMemo } from "react";
import { Search } from "react-bootstrap-icons";
import PageHeader from "../../../components/PageHeader/PageHeader";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import ActionButton from "../../../components/ActionButton/ActionButton";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import styles from "./AdminAssetHistoryPage.module.css";

/**
 * [공통 설정]
 */

// API 연동 시 대체 예정
const MOCK_HISTORY = [
  {
    id: 1, no: 1,
    requestedAt: "2026-03-24", requestType: "등록",
    prevState: null, nextState: null,
    category: "노트북", assetName: "Gram",
    serialNumber: null, licenseKey: null,
    user: "나가영",
  },
  {
    id: 2, no: 2,
    requestedAt: "2026-03-24", requestType: "등록",
    prevState: null, nextState: null,
    category: null, assetName: "Figma",
    serialNumber: "QNS-056", licenseKey: "NA-64ER",
    user: "나국주",
  },
  {
    id: 3, no: 3,
    requestedAt: "2026-03-24", requestType: "반납",
    prevState: null, nextState: null,
    category: "노트북", assetName: "Galaxy book 5",
    serialNumber: null, licenseKey: "FD-BN21",
    user: "나국주",
  },
  {
    id: 4, no: 4,
    requestedAt: "2026-03-24", requestType: "등록",
    prevState: null, nextState: null,
    category: null, assetName: "Source Insight 4.0 (SDOE)",
    serialNumber: "ZSP-G12", licenseKey: "SG-N564",
    user: "나국주",
  },
  {
    id: 5, no: 5,
    requestedAt: "2026-03-24", requestType: "상태 변경",
    prevState: "사용중", nextState: "보관중",
    category: "노트북", assetName: "ThinkPad X1 Carbon Gen 11",
    serialNumber: null, licenseKey: "ERH-561",
    user: "나국주",
  },
];

const REQUEST_TYPE_STYLE = {
  "등록":    styles.badgeRegister,
  "반납":    styles.badgeReturn,
  "상태 변경": styles.badgeStateChange,
  "위치 이동": styles.badgeMove,
};

const STATE_BADGE_STYLE = {
  "사용중":    styles.stateActive,
  "보관중":    styles.stateStored,
  "미사용":    styles.stateInactive,
  "만료 예정": styles.stateExpiring,
};

const COLUMNS = [
  { key: "no",          label: "No" },
  { key: "requestedAt", label: "요청일" },
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
    key: "prevState",
    label: "변경 전",
    renderCell: (row) =>
      row.prevState
        ? <span className={`${styles.badge} ${STATE_BADGE_STYLE[row.prevState] ?? ""}`}>{row.prevState}</span>
        : <span className={styles.dash}>-</span>,
  },
  {
    key: "nextState",
    label: "변경 후",
    renderCell: (row) =>
      row.nextState
        ? <span className={`${styles.badge} ${STATE_BADGE_STYLE[row.nextState] ?? ""}`}>{row.nextState}</span>
        : <span className={styles.dash}>-</span>,
  },
  { key: "category",     label: "자산 종류", renderCell: (row) => row.category    ?? <span className={styles.dash}>-</span> },
  { key: "assetName",    label: "자산명" },
  { key: "serialNumber", label: "시리얼",    renderCell: (row) => row.serialNumber ?? <span className={styles.dash}>-</span> },
  { key: "licenseKey",   label: "라이선스",  renderCell: (row) => row.licenseKey   ?? <span className={styles.dash}>-</span> },
  { key: "user",         label: "사용자" },
];

const AdminAssetHistoryPage = () => {
  // --- [State: 필터] ---
  const [filterType,     setFilterType]     = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState,    setFilterState]    = useState("");
  const [filterUser,     setFilterUser]     = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [filterKeyword,  setFilterKeyword]  = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  // --- [State: 삭제 모드] ---
  const [isDeleteMode,      setIsDeleteMode]      = useState(false);
  const [selectedIds,       setSelectedIds]       = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- [필터 적용된 rows] ---
  const filteredRows = useMemo(() => {
    return MOCK_HISTORY.filter((row) => {
      if (filterUser     && row.user        !== filterUser)    return false;
      if (filterDateFrom && row.requestedAt <  filterDateFrom) return false;
      if (filterDateTo   && row.requestedAt >  filterDateTo)   return false;
      if (appliedKeyword) {
        const kw = appliedKeyword.toLowerCase();
        const searchTarget = [row.assetName, row.user, row.category, row.serialNumber, row.licenseKey]
          .filter(Boolean).join(" ").toLowerCase();
        if (!searchTarget.includes(kw)) return false;
      }
      return true;
    }).map((row, i) => ({ ...row, no: i + 1 }));
  }, [filterUser, filterDateFrom, filterDateTo, appliedKeyword]);

  // 사용자 목록 (mock에서 중복 제거)
  const userOptions = useMemo(() =>
    [...new Set(MOCK_HISTORY.map((r) => r.user))],
  []);

  // --- [Handlers: 필터] ---
  const handleFilterReset = () => {
    setFilterType("");
    setFilterCategory("");
    setFilterState("");
    setFilterUser("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterKeyword("");
    setAppliedKeyword("");
  };

  const handleSearch = () => setAppliedKeyword(filterKeyword);

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

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
    <div className={styles.page}>
      <PageHeader
        title="내 자산 히스토리"
        desc="반납, 등록, 위치 이동에 관한 모든 이력을 조회합니다."
      />

      <section className={styles.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={styles.filterArea}>
            <select className={styles.filterSelect} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">자산 유형 전체</option>
              <option value="enterprise">PC</option>
              <option value="sw">SW</option>
            </select>

            <select className={styles.filterSelect} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">자산 종류 전체</option>
              <option value="노트북">노트북</option>
              <option value="데스크탑">데스크탑</option>
              <option value="모니터">모니터</option>
            </select>

            <select className={styles.filterSelect} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
              <option value="">상태 전체</option>
              <option value="등록">등록</option>
              <option value="반납">반납</option>
              <option value="상태 변경">상태 변경</option>
              <option value="위치 이동">위치 이동</option>
            </select>

            <select className={styles.filterSelect} value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option value="">사용자 전체</option>
              {userOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>

            {/* 날짜 범위 */}
            <input
              type="date"
              className={styles.filterDate}
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
            <span className={styles.dateSeparator}>~</span>
            <input
              type="date"
              className={styles.filterDate}
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />

            <ActionButton variant="white" size="sm" label="초기화" onClick={handleFilterReset} />

            {/* 검색 */}
            <div className={styles.filterSearchWrap}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="검색어를 입력하세요"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
              />
              <button className={styles.filterSearchBtn} onClick={handleSearch}>
                <Search size={14} />
              </button>
            </div>
          </div>

          {/* 삭제 버튼 영역 */}
          <div className={styles.tableHeader}>
            {isDeleteMode ? (
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

export default AdminAssetHistoryPage;
