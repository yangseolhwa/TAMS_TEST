import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircleFill, Search, ClipboardPlus } from "react-bootstrap-icons";
import Banner from "../../../components/Banner/Banner";
import TabCard from "../../../components/TabCard/TabCard";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, { createInitialItem } from "../../../components/RequestFormFields/RequestFormFields";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import Card from "../../../components/Card/Card";
import styles from "./UserMyAssetsPage.module.css";
import DataTable from "../../../components/DataTable/DataTable";
import { fetchPersonalAssets, fetchEnterpriseCategories } from "../../../services/assetService";

/**
 * [공통 설정]
 */
const MAX_ITEMS = 5;

const INNER_TABS = [
  { id: "request", label: "자산 등록 요청" },
  { id: "status",  label: "자산 요청 현황" },
];

// 자산 현황 탭용 컬럼
const REQUEST_STATUS_COLUMNS = [
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

const REQUEST_STATUS_MAP = {
  PENDING:  { label: "대기", color: "yellow" },
  APPROVED: { label: "승인", color: "green"  },
  REJECTED: { label: "반려", color: "red"    },
};

// 내 자산 조회 탭용 컬럼
const ASSET_LIST_COMMON_COLUMNS = [
  { key: "no",                 label: "No" },
  { key: "asset_type_label",   label: "자산 유형",   type: "assetType" },
  { key: "item_category_name", label: "자산 종류",   type: "dash" },
  { key: "asset_name",         label: "자산명",       type: "dash" },
  { key: "state",              label: "상태",         type: "status" },
];

const ASSET_LIST_COLUMNS_PC = [
  ...ASSET_LIST_COMMON_COLUMNS,
  { key: "spec",             label: "규격",       type: "dash" },
  { key: "serial_number",    label: "시리얼",     type: "dash" },
  { key: "acquisition_date", label: "등록일",     type: "dash" },
  { key: "return_date",      label: "반납일",     type: "dash" },
];

const ASSET_LIST_COLUMNS_SW = [
  ...ASSET_LIST_COMMON_COLUMNS,
  { key: "license_key",       label: "라이선스",    type: "dash" },
  { key: "subscription_date", label: "구독 만료일", type: "dash" },
];

const ASSET_LIST_STATUS_MAP = {
  active:   { label: "사용중",    color: "green"  },
  inactive: { label: "미사용",    color: "gray"   },
  stored:   { label: "보관중",    color: "blue"   },
  expiring: { label: "만료 예정", color: "yellow" },
};

const STATE_OPTIONS = {
  "": [
    { value: "active",   label: "사용중" },
    { value: "inactive", label: "미사용" },
    { value: "stored",   label: "보관중" },
    { value: "expiring", label: "만료 예정" },
  ],
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

const SW_FILTER_CATEGORIES = ["dev", "design", "collaboration", "security", "other"];

const UserMyAssetsPage = () => {
  // --- [State] ---
  const [activeTab, setActiveTab] = useState(INNER_TABS[0].id);
  const [items, setItems] = useState([createInitialItem()]); // 등록 요청 폼 아이템
  const [requestSelectedIds, setRequestSelectedIds] = useState([]); // 요청 현황 선택
  const [listSelectedIds, setListSelectedIds] = useState([]); // 내 자산 조회 선택

  // 필터 상태
  const [filterType,     setFilterType]     = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState,     setFilterState]    = useState("");
  const [filterKeyword,   setFilterKeyword]  = useState("");
  const [queryParams,     setQueryParams]    = useState({});

  // 모달 상태
  const [showResetConfirm,     setShowResetConfirm]     = useState(false);
  const [showReturnConfirm,    setShowReturnConfirm]    = useState(false);
  const [showMoveConfirm,      setShowMoveConfirm]      = useState(false);
  const [showNoSelectionModal, setShowNoSelectionModal] = useState(false);

  // --- [React Query] ---
  const { data: listRows = [], isLoading } = useQuery({
    queryKey: ["personalAssets", queryParams],
    queryFn: () => fetchPersonalAssets(queryParams),
    refetchOnWindowFocus: false,
  });

  // PC 카테고리 목록
  const { data: enterpriseCategories = [] } = useQuery({
    queryKey: ["enterpriseCategories"],
    queryFn: fetchEnterpriseCategories,
    refetchOnWindowFocus: false,
  });

  // 자산 유형에 따라 카테고리 옵션 결정
  const categoryOptions =
    filterType === "enterprise" ? enterpriseCategories.map((c) => ({ value: c.id,   label: c.name })) :
    filterType === "sw"         ? SW_FILTER_CATEGORIES.map((v) => ({ value: v,       label: v      })) :
    [
      ...enterpriseCategories.map((c) => ({ value: `pc_${c.id}`, label: c.name })),
      ...SW_FILTER_CATEGORIES.map((v)  => ({ value: `sw_${v}`,   label: v      })),
    ];

  // --- [Handlers: 등록 요청 폼] ---
  const handleAssetTypeChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...createInitialItem(), id: item.id, assetType: value } : item
      )
    );
  };

  const handleAssetCategoryChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, assetCategory: value } : item))
    );
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddItem = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, createInitialItem()]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
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
              licenseKeys: item.licenseKeys.map((key, j) => (j === keyIndex ? value : key)),
            }
          : item
      )
    );
  };

  const handleReset = () => {
    setItems([createInitialItem()]);
    setShowResetConfirm(false);
  };

  const handleSubmit = () => {
    // TODO: API 연동
  };

  // --- [Handlers: 조회 필터] ---

  // 필터 값들로 API 파라미터 객체 생성
  const buildParams = ({ type, category, state, keyword } = {}) => {
    const params = {};
    if (category) {
      if (type === "enterprise") {
        params.type = type;
        params.category_id = category;
      } else if (type === "sw") {
        params.type = type;
        params.software_type = category;
      } else if (category.startsWith("pc_")) {
        params.type = "enterprise";
        params.category_id = category.replace("pc_", "");
      } else if (category.startsWith("sw_")) {
        params.type = "sw";
        params.software_type = category.replace("sw_", "");
      }
    } else if (type) {
      params.type = type;
    }
 
    if (state)   params.state   = state;
    if (keyword) params.keyword = keyword;
 
    return params;
  };

  // 자산 유형 변경 시 즉시 적용 (카테고리/상태 초기화)
  const handleFilterTypeChange = (e) => {
    const value = e.target.value;
    setFilterType(value);
    setFilterCategory("");
    setFilterState("");
    setQueryParams(buildParams({ type: value }));
  };

  // 자산 종류 변경 시 즉시 적용
  const handleFilterCategoryChange = (e) => {
    const value = e.target.value;
    setFilterCategory(value);
    setQueryParams(buildParams({ type: filterType, category: value, state: filterState }));
  };

  // 상태 변경 시 즉시 적용
  const handleFilterStateChange = (e) => {
    const value = e.target.value;
    setFilterState(value);
    setQueryParams(buildParams({ type: filterType, category: filterCategory, state: value }));
  };

  // 검색 버튼: 키워드 전용 (현재 드롭다운 필터 유지)
  const handleSearch = () => {
    setQueryParams(buildParams({ type: filterType, category: filterCategory, state: filterState, keyword: filterKeyword }));
  };

  const handleFilterReset = () => {
    setFilterType("");
    setFilterCategory("");
    setFilterState("");
    setFilterKeyword("");
    setQueryParams({});
  };

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // --- [Handlers: 자산 액션] ---
  const handleReturnClick = () => {
    if (listSelectedIds.length === 0) return setShowNoSelectionModal(true);
    setShowReturnConfirm(true);
  };

  const handleMoveClick = () => {
    if (listSelectedIds.length === 0) return setShowNoSelectionModal(true);
    setShowMoveConfirm(true);
  };

  const handleReturnConfirm = () => {
    console.log("반납 대상:", listSelectedIds);
    setShowReturnConfirm(false);
  };

  const handleMoveConfirm = () => {
    console.log("이동 대상:", listSelectedIds);
    setShowMoveConfirm(false);
  };

  // DataTable 바로 위에 추가
  const assetListColumns =
    filterType === "enterprise" ? ASSET_LIST_COLUMNS_PC :
    filterType === "sw"         ? ASSET_LIST_COLUMNS_SW :
    ASSET_LIST_COMMON_COLUMNS;

  return (
    <div className={styles.page}>
      <PageHeader title="내 자산 관리" desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요." />

      {/* 섹션 1: 내 자산 등록 및 현황 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <ClipboardPlus size={15} />
          <span>내 자산 등록</span>
        </div>

        <TabCard tabs={INNER_TABS} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === INNER_TABS[0].id ? (
            <>
              <Banner
                text={
                  <>
                    소프트웨어 및 PC 장비를 최대 <strong>5개</strong>까지 동시에 요청할 수 있습니다. 처리 상태는 <strong>자산 요청 현황</strong>에서 확인하세요.
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
                    <PlusCircleFill size={15} /> 항목 추가 ({items.length} / {MAX_ITEMS})
                  </button>
                )}
                <div className={styles.actionBtns}>
                  <button className={styles.resetBtn} onClick={() => setShowResetConfirm(true)}>초기화</button>
                  <button className={styles.submitBtn} onClick={handleSubmit}>요청</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Banner text={<>승인 / 반려 항목은 처리 후 <strong>24시간</strong>이 경과하면 목록에서 자동 삭제됩니다.</>} />
              <DataTable
                columns={REQUEST_STATUS_COLUMNS}
                rows={[]} // TODO: 요청 현황 API 연동 시 교체
                statusMap={REQUEST_STATUS_MAP}
                selectedIds={requestSelectedIds}
                onSelectionChange={setRequestSelectedIds}
                totalCount={0}
              />
            </>
          )}
        </TabCard>
      </section>

      {/* 섹션 2: 내 자산 조회 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Search size={15} />
          <span>내 자산 조회</span>
        </div>

        <Card>
          <div className={styles.filterArea}>
            <select className={styles.filterSelect} value={filterType} onChange={handleFilterTypeChange}>
              <option value="">자산 유형 전체</option>
              <option value="enterprise">PC</option>
              <option value="sw">SW</option>
            </select>

            <select className={styles.filterSelect} value={filterCategory} onChange={handleFilterCategoryChange}>
              <option value="">자산 종류 전체</option>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select className={styles.filterSelect} value={filterState} onChange={handleFilterStateChange}>
              <option value="">상태 전체</option>
              {(STATE_OPTIONS[filterType] || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <button className={styles.filterResetBtn} onClick={handleFilterReset}>초기화</button>

            <div className={styles.filterSearchWrap}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="검색어를 입력하세요"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
              />
              <button className={styles.filterSearchBtn} onClick={handleSearch}><Search size={14} /></button>
            </div>
          </div>

          <div className={styles.listTableActions}>
            <button className={styles.moveBtn} onClick={handleMoveClick}>자산 이동</button>
            <button className={styles.returnBtn} onClick={handleReturnClick}>반납 요청</button>
          </div>

          <DataTable
            columns={assetListColumns}
            rows={listRows}
            statusMap={ASSET_LIST_STATUS_MAP}
            selectedIds={listSelectedIds}
            onSelectionChange={setListSelectedIds}
            totalCount={listRows.length}
            isLoading={isLoading}
          />
        </Card>
      </section>

      {/* 모달 모음 */}
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
