import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircleFill, Search, ClipboardPlus } from "react-bootstrap-icons";
import toast from "react-hot-toast";
import Banner from "../../../components/Banner/Banner";
import TabCard from "../../../components/TabCard/TabCard";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, { createInitialItem } from "../../../components/RequestFormFields/RequestFormFields";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import Card from "../../../components/Card/Card";
import styles from "./UserMyAssetsPage.module.css";
import DataTable from "../../../components/DataTable/DataTable";
import { fetchPersonalAssets, fetchEnterpriseCategories, moveEnterpriseAssets, moveSwAssets, returnEnterpriseAssets, returnSwAssets } from "../../../services/assetService";

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
  { key: "manufacturer",       label: "제조사",       type: "dash" },
  { key: "location",           label: "위치",         type: "dash" },
  { key: "state",              label: "상태",         type: "status" },
];

const ASSET_LIST_STATE_COLUMN  = { key: "state",    label: "상태", type: "status" };
const ASSET_LIST_LOCATION_COLUMN = { key: "location", label: "위치", type: "dash" };

const ASSET_LIST_COLUMNS_PC = [
  ...ASSET_LIST_COMMON_COLUMNS.filter((col) => col.key !== "location" && col.key !== "state"),
  { key: "spec",             label: "규격",       type: "dash" },
  { key: "serial_number",    label: "시리얼",     type: "dash" },
  { key: "acquisition_date", label: "등록일",     type: "dash" },
  ASSET_LIST_LOCATION_COLUMN,
  ASSET_LIST_STATE_COLUMN,
];

const ASSET_LIST_COLUMNS_SW = [
  ...ASSET_LIST_COMMON_COLUMNS.filter((col) => col.key !== "location" && col.key !== "state"),
  { key: "license_key",       label: "라이선스",    type: "dash" },
  { key: "subscription_date", label: "구독 만료일", type: "dash" },
  ASSET_LIST_LOCATION_COLUMN,
  ASSET_LIST_STATE_COLUMN,
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

  // 이동 모드 상태
  const [isMoveMode,    setIsMoveMode]    = useState(false);
  const [locationEdits, setLocationEdits] = useState({}); // { [rowId]: string }

  // 반납 모드 상태
  const [isReturnMode,  setIsReturnMode]  = useState(false);
  const [returnRemarks, setReturnRemarks] = useState("");

  const queryClient = useQueryClient();

  // --- [React Query] ---
  const { data: listRows = [], isLoading } = useQuery({
    queryKey: ["personalAssets", queryParams],
    queryFn: () => fetchPersonalAssets(queryParams),
    refetchOnWindowFocus: false,
  });

  // 자산 이동 Mutation — 선택 행별로 입력된 location으로 PC/SW 분리 호출
  const moveMutation = useMutation({
    mutationFn: async () => {
      const rowsById = listRows.reduce((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});

      const getLocation = (rowId) => {
        const row = rowsById[rowId];
        return locationEdits[rowId] ?? row?.location ?? "";
      };

      const pcGroups = {};
      const swGroups = {};

      listSelectedIds.forEach((rowId) => {
        const loc = getLocation(rowId);
        if (rowId.startsWith("ent-")) {
          const assetId = parseInt(rowId.replace("ent-", ""), 10);
          if (!pcGroups[loc]) pcGroups[loc] = [];
          pcGroups[loc].push(assetId);
        } else if (rowId.startsWith("sw-")) {
          const licenseId = parseInt(rowId.split("-")[2], 10);
          if (!swGroups[loc]) swGroups[loc] = [];
          swGroups[loc].push(licenseId);
        }
      });

      const calls = [
        ...Object.entries(pcGroups).map(([location, asset_ids])   => moveEnterpriseAssets({ asset_ids, location })),
        ...Object.entries(swGroups).map(([location, license_ids]) => moveSwAssets({ license_ids, location })),
      ];

      await Promise.all(calls);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalAssets"] });
      toast.success("자산 위치가 변경되었습니다.");
      cancelMoveMode();
    },
    onError: (err) => {
      toast.error(err.message);
      setShowMoveConfirm(false);
    },
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

  // 반납 Mutation — PC/SW ID 분리 후 Promise.all로 동시 호출
  const returnMutation = useMutation({
    mutationFn: async () => {
      const pcIds      = [];
      const licenseIds = [];

      listSelectedIds.forEach((rowId) => {
        if (rowId.startsWith("ent-")) {
          pcIds.push(parseInt(rowId.replace("ent-", ""), 10));
        } else if (rowId.startsWith("sw-")) {
          licenseIds.push(parseInt(rowId.split("-")[2], 10));
        }
      });

      const calls = [
        ...(pcIds.length      > 0 ? [returnEnterpriseAssets({ asset_ids: pcIds })]   : []),
        ...(licenseIds.length > 0 ? [returnSwAssets({ license_ids: licenseIds })]     : []),
      ];

      await Promise.all(calls);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalAssets"] });
      toast.success("반납이 완료되었습니다.");
      cancelReturnMode();
    },
    onError: (err) => {
      toast.error(err.message);
      setShowReturnConfirm(false);
    },
  });

  // 반납 1단계: 버튼 클릭 → 반납 모드 진입 (비고란 활성화)
  const handleReturnClick = () => {
    if (listSelectedIds.length === 0) return setShowNoSelectionModal(true);
    setReturnRemarks("");
    setIsReturnMode(true);
  };

  // 반납 2단계: 반납 확인 버튼 클릭 → 확인 모달 오픈
  const handleReturnConfirmClick = () => {
    setShowReturnConfirm(true);
  };

  // 반납 3단계: 모달 확인 → API 호출
  const handleReturnConfirm = () => {
    returnMutation.mutate();
    setShowReturnConfirm(false);
  };

  // 반납 모드 취소
  const cancelReturnMode = () => {
    setIsReturnMode(false);
    setReturnRemarks("");
    setListSelectedIds([]);
    setShowReturnConfirm(false);
  };

  // 이동 1단계: 버튼 클릭 → 이동 모드 진입 (선택 행의 location 셀이 input으로 전환)
  const handleMoveClick = () => {
    if (listSelectedIds.length === 0) return setShowNoSelectionModal(true);
    setLocationEdits({});
    setIsMoveMode(true);
  };

  // 이동 2단계: 저장 클릭 → 확인 모달
  const handleMoveSaveClick = () => {
    setShowMoveConfirm(true);
  };

  // 이동 3단계: 모달 확인 → API 호출
  const handleMoveConfirm = () => {
    moveMutation.mutate();
    setShowMoveConfirm(false);
  };

  const cancelMoveMode = () => {
    setIsMoveMode(false);
    setLocationEdits({});
    setListSelectedIds([]);
    setShowMoveConfirm(false);
  };

  // 이동 모드일 때 선택된 행의 location 컬럼을 인라인 input으로 교체
  const assetListColumns = useMemo(() => {
    const base =
      filterType === "enterprise" ? ASSET_LIST_COLUMNS_PC :
      filterType === "sw"         ? ASSET_LIST_COLUMNS_SW :
      ASSET_LIST_COMMON_COLUMNS;

    if (!isMoveMode) return base;

    return base.map((col) => {
      if (col.key !== "location") return col;
      return {
        ...col,
        renderCell: (row) => {
          if (!listSelectedIds.includes(row.id)) return row.location || "—";
          return (
            <input
              className={styles.locationInput}
              value={locationEdits[row.id] ?? row.location ?? ""}
              onChange={(e) =>
                setLocationEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
              }
              placeholder="위치 입력"
            />
          );
        },
      };
    });
  }, [filterType, isMoveMode, listSelectedIds, locationEdits]);

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
            {isMoveMode ? (
              <>
                <button className={styles.moveCancelBtn} onClick={cancelMoveMode}>
                  취소
                </button>
                <button
                  className={styles.moveSaveBtn}
                  onClick={handleMoveSaveClick}
                  disabled={moveMutation.isPending}
                >
                  저장
                </button>
              </>
            ) : (
              <>
                <button className={styles.moveBtn} onClick={handleMoveClick} disabled={isReturnMode}>자산 이동</button>
                {isReturnMode ? (
                  <>
                    <button className={styles.returnCancelBtn} onClick={cancelReturnMode}>취소</button>
                    <button
                      className={styles.returnConfirmBtn}
                      onClick={handleReturnConfirmClick}
                      disabled={returnMutation.isPending}
                    >
                      반납 확인
                    </button>
                  </>
                ) : (
                  <button className={styles.returnBtn} onClick={handleReturnClick}>반납 요청</button>
                )}
              </>
            )}
          </div>

          {/* 비고란 — 반납 모드에서만 표시 */}
          {isReturnMode && (
            <div className={styles.modeArea}>
              <label className={styles.modeAreaLabel}>비고</label>
              <input
                className={styles.modeAreaInput}
                type="text"
                placeholder="반납 사유 또는 메모를 입력하세요 (선택)"
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
              />
            </div>
          )}

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
        title={`선택한 자산 ${listSelectedIds.length}개를 반납할까요?`}
        desc="반납된 자산은 목록에서 제외됩니다."
        confirmLabel="반납"
        confirmVariant="danger"
        onConfirm={handleReturnConfirm}
        onCancel={() => setShowReturnConfirm(false)}
      />
      <ConfirmModal
        isOpen={showMoveConfirm}
        title={`선택한 자산 ${listSelectedIds.length}개를 이동할까요?`}
        desc="입력한 위치로 각 자산이 이동됩니다."
        confirmLabel="이동"
        confirmVariant="primary"
        onConfirm={handleMoveConfirm}
        onCancel={() => setShowMoveConfirm(false)}
      />
    </div>
  );
};

export default UserMyAssetsPage;
