import { useState } from "react";
import { PlusCircleFill, Search, ClipboardPlus } from "react-bootstrap-icons";
import Banner from "../../../components/Banner/Banner";
import TabCard from "../../../components/TabCard/TabCard";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, { createInitialItem, ASSET_CATEGORIES } from "../../../components/RequestFormFields/RequestFormFields";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import Card from "../../../components/Card/Card";
import styles from "./UserMyAssetsPage.module.css";
import DataTable from "../../../components/DataTable/DataTable";

const columns = [
  { key: "no",          label: "No" },
  { key: "assetType",   label: "자산 유형",  type: "assetType" },
  { key: "assetName",   label: "자산명" },
  { key: "spec",        label: "규격",        type: "dash" },
  { key: "requestType", label: "요청 구분" },
  { key: "requestedAt", label: "요청일" },
  { key: "processedAt", label: "처리일",      type: "dash" },
  { key: "status",      label: "상태",        type: "status" },
  { key: "reason",      label: "사유",        type: "dash" },
];

const statusMap = {
  PENDING:  { label: "대기", color: "yellow" },
  APPROVED: { label: "승인", color: "green"  },
  REJECTED: { label: "반려", color: "red"    },
};

const listColumns = [
  { key: "no",                 label: "No" },
  { key: "assetType",          label: "자산 유형",   type: "assetType" },
  { key: "assetCategory",      label: "자산 종류",   type: "dash" },
  { key: "assetName",          label: "자산명",       type: "dash" },
  { key: "spec",               label: "규격",         type: "dash" },
  { key: "serialNumber",       label: "시리얼",       type: "dash" },
  { key: "licenseKey",         label: "라이선스",     type: "dash" },
  { key: "registeredAt",       label: "등록일",       type: "dash" },
  { key: "returnDate",         label: "반납일",       type: "dash" },
  { key: "subscriptionExpiry", label: "구독 만료일",  type: "dash" },
  { key: "location",           label: "위치",         type: "dash" },
  { key: "status",             label: "상태",         type: "status" },
];

const listStatusMap = {
  ACTIVE:   { label: "사용중",    color: "green"  },
  INACTIVE: { label: "미사용",    color: "gray"   },
  STORED:   { label: "보관중",    color: "blue"   },
  EXPIRING: { label: "만료 예정", color: "yellow" },
};

const MAX_ITEMS = 5;

const INNER_TABS = [
  { id: "request", label: "자산 등록 요청" },
  { id: "status",  label: "자산 요청 현황" },
];

const STATE_OPTIONS = {
  enterprise: [
    { value: "active",   label: "사용중" },
    { value: "inactive", label: "미사용" },
    { value: "stored",   label: "보관중" },
  ],
  sw: [
    { value: "active",   label: "사용중" },
    { value: "expiring", label: "만료 예정" },
    { value: "stored",   label: "보관중" },
  ],
};

// 필터 자산 유형 값 → ASSET_CATEGORIES 키 매핑
const FILTER_TYPE_TO_CATEGORY_KEY = {
  enterprise: "pc",
  sw:         "sw",
};

const UserMyAssetsPage = () => {
  const [selectedIds,      setSelectedIds]      = useState([]);
  const [rows,             setRows]             = useState([]); // API 연동 전 빈 배열
  const [listRows,         setListRows]         = useState([]); // API 연동 전 빈 배열
  const [listSelectedIds,  setListSelectedIds]  = useState([]);
  const [activeTab,        setActiveTab]        = useState(INNER_TABS[0].id);
  const [items,            setItems]            = useState([createInitialItem()]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [filterType,     setFilterType]     = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState,    setFilterState]    = useState("");
  const [filterKeyword,  setFilterKeyword]  = useState("");

  const [showReturnConfirm,    setShowReturnConfirm]    = useState(false);
  const [showMoveConfirm,      setShowMoveConfirm]      = useState(false);
  const [showNoSelectionModal, setShowNoSelectionModal] = useState(false);

  const handleAssetTypeChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...createInitialItem(), id: item.id, assetType: value } : item
      )
    );
  };

  const handleAssetCategoryChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, assetCategory: value } : item
      )
    );
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddItem = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, createInitialItem()]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setItems([createInitialItem()]);
    setShowResetConfirm(false);
  };

  const handleSubmit = () => {
    // API 연동 시 구현
  };

  const handleAddLicenseKey = (index) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, licenseKeys: [...item.licenseKeys, ""] } : item
      )
    );
  };

  const handleRemoveLicenseKey = (itemIndex, keyIndex) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? { ...item, licenseKeys: item.licenseKeys.filter((_, j) => j !== keyIndex) }
          : item
      )
    );
  };

  const handleLicenseKeyChange = (itemIndex, keyIndex, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              licenseKeys: item.licenseKeys.map((key, j) =>
                j === keyIndex ? value : key
              ),
            }
          : item
      )
    );
  };

  const handleFilterTypeChange = (e) => {
    setFilterType(e.target.value);
    setFilterCategory("");
    setFilterState("");
  };

  const handleFilterReset = () => {
    setFilterType("");
    setFilterCategory("");
    setFilterState("");
    setFilterKeyword("");
  };

  const handleSearch = () => {
    // API 연동 시 구현 예정
  };

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleReturnClick = () => {
  if (listSelectedIds.length === 0) {
    setShowNoSelectionModal(true);
    return;
  }
  setShowReturnConfirm(true);
};

const handleMoveClick = () => {
  if (listSelectedIds.length === 0) {
    setShowNoSelectionModal(true);
    return;
  }
  setShowMoveConfirm(true);
};

const handleReturnConfirm = () => {
  // API 연동 시 구현
  setShowReturnConfirm(false);
};

const handleMoveConfirm = () => {
  // API 연동 시 구현
  setShowMoveConfirm(false);
};

  return (
    <div className={styles.page}>
      <PageHeader
        title="내 자산 관리"
        desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요."
      />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <ClipboardPlus size={15} />
          <span>내 자산 등록</span>
        </div>

        <TabCard tabs={INNER_TABS} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === INNER_TABS[0].id && (
            <>
              <Banner
                text={
                  <>
                    소프트웨어 및 PC 장비를 최대 <strong>5개</strong>까지 동시에 요청할 수 있습니다.
                    처리 상태는 <strong>자산 요청 현황</strong>에서 확인하세요.
                  </>
                }
              />

              <RequestFormFields
                items={items}
                onAssetTypeChange={handleAssetTypeChange}
                onAssetCategoryChange={handleAssetCategoryChange}
                onItemChange={handleItemChange}
                onRemoveItem={handleRemoveItem}
                onAddLicenseKey={handleAddLicenseKey}
                onRemoveLicenseKey={handleRemoveLicenseKey}
                onLicenseKeyChange={handleLicenseKeyChange}
              />

              <div className={styles.formActions}>
                {items.length < MAX_ITEMS && (
                  <button className={styles.addItemBtn} onClick={handleAddItem}>
                    <PlusCircleFill size={15} />
                    항목 추가 ({items.length} / {MAX_ITEMS})
                  </button>
                )}
                <div className={styles.actionBtns}>
                  <button
                    className={styles.resetBtn}
                    onClick={() => setShowResetConfirm(true)}
                  >
                    초기화
                  </button>
                  <button className={styles.submitBtn} onClick={handleSubmit}>
                    요청
                  </button>
                </div>
              </div>
            </>
          )}
          {activeTab === INNER_TABS[1].id && (
            <>
              <Banner
                text={
                  <>
                    승인 / 반려 항목은 처리 후 <strong>24시간</strong>이 경과하면 목록에서 자동 삭제됩니다.
                  </>
                }
              />

              <DataTable
                columns={columns}
                rows={rows}
                statusMap={statusMap}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                totalCount={rows.length}
              />
            </>
          )}
        </TabCard>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Search size={15} />
          <span>내 자산 조회</span>
        </div>

        <Card>
          <div className={styles.filterArea}>
            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={handleFilterTypeChange}
            >
              <option value="">자산 유형 전체</option>
              <option value="enterprise">PC</option>
              <option value="sw">SW</option>
            </select>

            <select
              className={styles.filterSelect}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">자산 종류 전체</option>
              {(ASSET_CATEGORIES[FILTER_TYPE_TO_CATEGORY_KEY[filterType]] || []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
            >
              <option value="">상태 전체</option>
              {(STATE_OPTIONS[filterType] || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button className={styles.filterResetBtn} onClick={handleFilterReset}>
              초기화
            </button>

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

          <div className={styles.listTableActions}>
            <button className={styles.moveBtn} onClick={handleMoveClick}>
              자산 이동
            </button>
            <button className={styles.returnBtn} onClick={handleReturnClick}>
              반납 요청
            </button>
          </div>

          <DataTable
            columns={listColumns}
            rows={listRows}
            statusMap={listStatusMap}
            selectedIds={listSelectedIds}
            onSelectionChange={setListSelectedIds}
            totalCount={listRows.length}
          />
        </Card>
      </section>

      <ConfirmModal
        isOpen={showResetConfirm}
        title="입력 내용을 초기화할까요?"
        desc="작성한 모든 항목이 삭제되고 초기 상태로 돌아갑니다."
        confirmLabel="초기화"
        confirmVariant="danger"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      <ConfirmModal
        isOpen={showNoSelectionModal}
        title="자산을 선택해주세요."
        desc="반납 또는 이동할 자산을 먼저 선택해주세요."
        confirmLabel="확인"
        confirmVariant="primary"
        onConfirm={() => setShowNoSelectionModal(false)}
        onCancel={() => setShowNoSelectionModal(false)}
      />

      <ConfirmModal
        isOpen={showReturnConfirm}
        title="선택한 자산을 반납 요청할까요?"
        desc="반납 요청 후 관리자 승인이 필요합니다."
        confirmLabel="반납 요청"
        confirmVariant="danger"
        onConfirm={handleReturnConfirm}
        onCancel={() => setShowReturnConfirm(false)}
      />

      <ConfirmModal
        isOpen={showMoveConfirm}
        title="선택한 자산을 이동할까요?"
        confirmLabel="이동"
        confirmVariant="primary"
        onConfirm={handleMoveConfirm}
        onCancel={() => setShowMoveConfirm(false)}
      />
    </div>
  );
};

export default UserMyAssetsPage;