import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ClipboardPlus } from "react-bootstrap-icons";
import toast from "react-hot-toast";
import Banner from "../../../components/Banner/Banner";
import TabCard from "../../../components/TabCard/TabCard";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, { createInitialItem } from "../../../components/RequestFormFields/RequestFormFields";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import RejectReasonModal from "../../../components/RejectReasonModal/RejectReasonModal";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import styles from "./AdminMyAssetsPage.module.css";
import {
  fetchPersonalAssets,
  fetchEnterpriseCategories,
  fetchEnterpriseAssetsForForm,
  fetchSwAssetsForForm,
  moveEnterpriseAssets,
  moveSwAssets,
  returnEnterpriseAssets,
  returnSwAssets,
  requestEnterpriseAsset,
  requestSwAsset,
  fetchAssetRequests,
  approveEnterpriseRequest,
  approveSwRequest,
  rejectEnterpriseRequest,
  rejectSwRequest,
} from "../../../services/assetService";

/**
 * [공통 설정]
 */
const INNER_TABS = [
  { id: "request",  label: "자산 등록 요청" },
  { id: "register", label: "셀프 등록" },
];

// 자산 등록 요청 탭용 컬럼 (admin: 요청자 포함, admin은 pending만 조회)
const ADMIN_REQUEST_COLUMNS = [
  { key: "no",          label: "No" },
  { key: "requester",   label: "요청자",    type: "dash" },
  { key: "assetType",   label: "자산 유형", type: "assetType" },
  { key: "assetName",   label: "자산명" },
  { key: "spec",        label: "규격",      type: "dash" },
  { key: "requestType", label: "요청 구분" },
  { key: "requestedAt", label: "요청일" },
  { key: "status",      label: "상태",      type: "status" },
];

const REQUEST_STATUS_MAP = {
  PENDING:  { label: "대기", color: "yellow" },
  APPROVED: { label: "승인", color: "green"  },
  REJECTED: { label: "반려", color: "red"    },
};

// 내 자산 조회 탭용 컬럼
const ASSET_LIST_COMMON_COLUMNS = [
  { key: "no",                 label: "No" },
  { key: "asset_type_label",   label: "자산 유형",  type: "assetType" },
  { key: "item_category_name", label: "자산 종류",  type: "dash" },
  { key: "asset_name",         label: "자산명",      type: "dash" },
  { key: "manufacturer",       label: "제조사",      type: "dash" },
  { key: "location",           label: "위치",        type: "dash" },
  { key: "state",              label: "상태",        type: "status" },
];

const ASSET_LIST_STATE_COLUMN    = { key: "state",    label: "상태", type: "status" };
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

const AdminMyAssetsPage = () => {
  // --- [State] ---
  const [activeTab, setActiveTab] = useState(INNER_TABS[0].id);
  const [items, setItems] = useState([createInitialItem()]); // 셀프 등록 폼 (단일)
  const [requestSelectedIds, setRequestSelectedIds] = useState([]);
  const [listSelectedIds,    setListSelectedIds]    = useState([]);

  // 필터 상태
  const [filterType,     setFilterType]     = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState,    setFilterState]    = useState("");
  const [filterKeyword,  setFilterKeyword]  = useState("");
  const [queryParams,    setQueryParams]    = useState({});

  // 모달 상태
  const [showResetConfirm,     setShowResetConfirm]     = useState(false);
  const [showRegisterConfirm,  setShowRegisterConfirm]  = useState(false);
  const [showApproveConfirm,   setShowApproveConfirm]   = useState(false);
  const [showRejectModal,      setShowRejectModal]      = useState(false);
  const [showReturnConfirm,    setShowReturnConfirm]    = useState(false);
  const [showMoveConfirm,      setShowMoveConfirm]      = useState(false);
  const [showNoSelectionModal, setShowNoSelectionModal] = useState(false);

  // 반려 사유
  const [rejectReason, setRejectReason] = useState("");

  // 이동 모드 상태
  const [isMoveMode,    setIsMoveMode]    = useState(false);
  const [locationEdits, setLocationEdits] = useState({});

  const queryClient = useQueryClient();

  // --- [React Query] ---
  const { data: requestRows = [], isLoading: isRequestLoading } = useQuery({
    queryKey: ["assetRequests"],
    queryFn: fetchAssetRequests,
    refetchOnWindowFocus: false,
  });

  const { data: listRows = [], isLoading } = useQuery({
    queryKey: ["personalAssets", queryParams],
    queryFn: () => fetchPersonalAssets(queryParams),
    refetchOnWindowFocus: false,
  });

  const { data: enterpriseCategories = [] } = useQuery({
    queryKey: ["enterpriseCategories"],
    queryFn: fetchEnterpriseCategories,
    refetchOnWindowFocus: false,
  });

  const { data: enterpriseAssetsForForm = [] } = useQuery({
    queryKey: ["enterpriseAssetsForForm"],
    queryFn: fetchEnterpriseAssetsForForm,
    refetchOnWindowFocus: false,
  });

  const { data: swAssetsForForm = [] } = useQuery({
    queryKey: ["swAssetsForForm"],
    queryFn: fetchSwAssetsForForm,
    refetchOnWindowFocus: false,
  });

  // 자산 유형에 따라 카테고리 옵션 결정
  const categoryOptions =
    filterType === "enterprise" ? enterpriseCategories.map((c) => ({ value: c.id,    label: c.name })) :
    filterType === "sw"         ? SW_FILTER_CATEGORIES.map((v)  => ({ value: v,       label: v      })) :
    [
      ...enterpriseCategories.map((c) => ({ value: `pc_${c.id}`, label: c.name })),
      ...SW_FILTER_CATEGORIES.map((v)  => ({ value: `sw_${v}`,   label: v      })),
    ];

  // --- [Handlers: 셀프 등록 폼] ---
  const handleAssetTypeChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...createInitialItem(), id: item.id, assetType: value } : item
      )
    );
  };

  // fieldOrObject: 단일 필드명(string) 또는 { field: value, ... } 객체 (카스케이딩 초기화 등에 활용)
  const handleItemChange = (index, fieldOrObject, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (typeof fieldOrObject === "object") return { ...item, ...fieldOrObject };
        return { ...item, [fieldOrObject]: value };
      })
    );
  };

  const handleReset = () => {
    setItems([createInitialItem()]);
    setShowResetConfirm(false);
  };

  // 셀프 등록 Mutation — admin 직접 등록 (즉시 active)
  const registerMutation = useMutation({
    mutationFn: async () => {
      const item = items[0];

      if (item.assetType === "pc" && item.requestType === "new") {
        return requestEnterpriseAsset({
          is_existing: false,
          assets: [{
            asset_number:     item.assetNumber.trim(),
            model_name:       item.modelName.trim(),
            category_id:      Number(item.categoryId),
            item_type_id:     Number(item.itemTypeId),
            manufacturer:     item.manufacturer.trim(),
            acquisition_date: item.acquisitionDate,
            ...(item.spec.trim()          && { spec:              item.spec.trim() }),
            ...(item.serialNumber.trim()  && { serial_number:     item.serialNumber.trim() }),
            ...(item.requiredQuantity     && { required_quantity: Number(item.requiredQuantity) }),
            ...(item.requestReason.trim() && { request_reason:    item.requestReason.trim() }),
          }],
        });
      }

      if (item.assetType === "pc" && item.requestType === "existing") {
        return requestEnterpriseAsset({
          is_existing: true,
          assets: [{
            asset_id:         Number(item.selectedAssetId),
            acquisition_date: item.acquisitionDate,
            ...(item.spec.trim()          && { spec:              item.spec.trim() }),
            ...(item.serialNumber.trim()  && { serial_number:     item.serialNumber.trim() }),
            ...(item.requiredQuantity     && { required_quantity: Number(item.requiredQuantity) }),
            ...(item.requestReason.trim() && { request_reason:    item.requestReason.trim() }),
          }],
        });
      }

      if (item.assetType === "sw" && item.requestType === "new") {
        return requestSwAsset({
          is_existing: false,
          licenses: [{
            name:          item.swName.trim(),
            software_type: item.softwareType,
            manufacturer:  item.swManufacturer.trim(),
            license_key:   item.licenseKey.trim(),
            key_type:      item.keyType,
            ...(item.isSubscription !== ""  && { is_subscription: item.isSubscription === "true" }),
            ...(item.requestReason.trim()   && { request_reason:  item.requestReason.trim() }),
          }],
        });
      }

      if (item.assetType === "sw" && item.requestType === "existing") {
        return requestSwAsset({
          is_existing: true,
          licenses: [{
            asset_sw_id:  Number(item.selectedSwId),
            license_key:  item.licenseKey.trim(),
            key_type:     item.keyType,
            ...(item.requestReason.trim() && { request_reason: item.requestReason.trim() }),
          }],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personalAssets"] });
      toast.success("자산이 등록되었습니다.");
      setItems([createInitialItem()]);
      setShowRegisterConfirm(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setShowRegisterConfirm(false);
    },
  });

  const handleRegister = () => {
    const item = items[0];
    if (!item.assetType) {
      toast.error("자산 유형을 선택해주세요.");
      return;
    }
    if (item.assetType === "pc" && item.requestType === "existing") {
      if (!item.selectedAssetId || !item.acquisitionDate) {
        toast.error("PC 기존 자산: 자산 선택과 취득일은 필수 항목입니다.");
        return;
      }
    }
    if (item.assetType === "pc" && item.requestType === "new") {
      if (!item.assetNumber || !item.categoryId || !item.itemTypeId || !item.manufacturer || !item.modelName || !item.acquisitionDate) {
        toast.error("PC 신규 자산: 필수 항목을 모두 입력해주세요.");
        return;
      }
    }
    if (item.assetType === "sw" && item.requestType === "existing") {
      if (!item.selectedSwId || !item.licenseKey || !item.keyType) {
        toast.error("SW 기존 자산: 소프트웨어 선택, 라이선스키, 키 유형은 필수 항목입니다.");
        return;
      }
    }
    if (item.assetType === "sw" && item.requestType === "new") {
      if (!item.swName || !item.softwareType || !item.swManufacturer || !item.licenseKey || !item.keyType) {
        toast.error("SW 신규 자산: 필수 항목을 모두 입력해주세요.");
        return;
      }
    }
    setShowRegisterConfirm(true);
  };

  // --- [Handlers: 요청 승인/반려] ---

  // 승인 Mutation — 선택된 요청을 PC/SW 구분 후 Promise.all로 동시 처리
  const approveMutation = useMutation({
    mutationFn: async () => {
      const calls = requestSelectedIds.map((rowId) => {
        if (rowId.startsWith("req-ent-")) {
          const id = parseInt(rowId.replace("req-ent-", ""), 10);
          return approveEnterpriseRequest(id);
        } else {
          const id = parseInt(rowId.replace("req-sw-", ""), 10);
          return approveSwRequest(id);
        }
      });
      await Promise.all(calls);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetRequests"] });
      queryClient.invalidateQueries({ queryKey: ["personalAssets"] });
      toast.success("요청이 승인되었습니다.");
      setRequestSelectedIds([]);
      setShowApproveConfirm(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setShowApproveConfirm(false);
    },
  });

  // 반려 Mutation — 선택된 요청을 PC/SW 구분 후 Promise.all로 동시 처리
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const calls = requestSelectedIds.map((rowId) => {
        if (rowId.startsWith("req-ent-")) {
          const id = parseInt(rowId.replace("req-ent-", ""), 10);
          return rejectEnterpriseRequest(id, rejectReason);
        } else {
          const id = parseInt(rowId.replace("req-sw-", ""), 10);
          return rejectSwRequest(id, rejectReason);
        }
      });
      await Promise.all(calls);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetRequests"] });
      toast.success("요청이 반려되었습니다.");
      setRequestSelectedIds([]);
      setShowRejectModal(false);
      setRejectReason("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleApproveClick = () => {
    if (requestSelectedIds.length === 0) return setShowNoSelectionModal(true);
    setShowApproveConfirm(true);
  };

  const handleRejectClick = () => {
    if (requestSelectedIds.length === 0) return setShowNoSelectionModal(true);
    setRejectReason("");
    setShowRejectModal(true);
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
      setListSelectedIds([]);
      setShowReturnConfirm(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setShowReturnConfirm(false);
    },
  });

  // 반납: 버튼 클릭 → 바로 확인 모달 오픈
  const handleReturnClick = () => {
    if (listSelectedIds.length === 0) return setShowNoSelectionModal(true);
    setShowReturnConfirm(true);
  };

  // 반납: 모달 확인 → API 호출
  const handleReturnConfirm = () => {
    returnMutation.mutate();
  };

  // 이동 Mutation — 선택 행별로 입력된 location으로 PC/SW 분리 호출
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

  // 이동 1단계: 버튼 클릭 → 이동 모드 진입
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

      {/* 섹션 1: 자산 등록 요청 처리 및 셀프 등록 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <ClipboardPlus size={15} />
          <span>자산 등록</span>
        </div>

        <TabCard tabs={INNER_TABS} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === INNER_TABS[0].id ? (
            <>
              <Banner text={<>유저의 <strong>등록 요청</strong>을 승인하거나 반려할 수 있습니다. 처리된 요청은 목록에서 자동으로 제거됩니다.</>} />
              <div className={styles.requestTableActions}>
                <button className={styles.approveBtn} onClick={handleApproveClick}>승인</button>
                <button className={styles.rejectBtn}  onClick={handleRejectClick}>반려</button>
              </div>
              <DataTable
                columns={ADMIN_REQUEST_COLUMNS}
                rows={requestRows}
                statusMap={REQUEST_STATUS_MAP}
                selectedIds={requestSelectedIds}
                onSelectionChange={setRequestSelectedIds}
                totalCount={requestRows.length}
                isLoading={isRequestLoading}
              />
            </>
          ) : (
            <>
              <Banner text={<>자산 <strong>1개</strong>를 직접 등록합니다. 관리자 승인 없이 즉시 활성화됩니다.</>} />
              <RequestFormFields
                items={items}
                enterpriseAssets={enterpriseAssetsForForm}
                swAssets={swAssetsForForm}
                onAssetTypeChange={handleAssetTypeChange}
                onItemChange={handleItemChange}
              />
              <div className={styles.formActions}>
                <div className={styles.actionBtns}>
                  <button className={styles.resetBtn} onClick={() => setShowResetConfirm(true)}>초기화</button>
                  <button
                    className={styles.submitBtn}
                    onClick={handleRegister}
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "등록 중..." : "등록"}
                  </button>
                </div>
              </div>
            </>
          )}
        </TabCard>
      </section>

      {/* 섹션 2: 자산 조회 */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Search size={15} />
          <span>자산 조회</span>
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
                <button className={styles.moveCancelBtn} onClick={cancelMoveMode}>취소</button>
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
                <button className={styles.moveBtn}   onClick={handleMoveClick}>자산 이동</button>
                <button className={styles.returnBtn} onClick={handleReturnClick}>반납</button>
              </>
            )}
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
        isOpen={showRegisterConfirm}
        title="자산을 등록할까요?"
        desc="등록 즉시 자산이 활성화됩니다."
        confirmLabel="등록"
        confirmVariant="primary"
        onConfirm={() => registerMutation.mutate()}
        onCancel={() => setShowRegisterConfirm(false)}
      />
      <ConfirmModal
        isOpen={showApproveConfirm}
        title={`선택한 요청 ${requestSelectedIds.length}건을 승인할까요?`}
        desc="승인된 자산은 즉시 활성화됩니다."
        confirmLabel="승인"
        confirmVariant="primary"
        onConfirm={() => approveMutation.mutate()}
        onCancel={() => setShowApproveConfirm(false)}
      />
      <ConfirmModal
        isOpen={showNoSelectionModal}
        title="항목을 선택해주세요."
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

      <RejectReasonModal
        isOpen={showRejectModal}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={() => rejectMutation.mutate()}
        onCancel={() => setShowRejectModal(false)}
        isPending={rejectMutation.isPending}
      />
    </div>
  );
};

export default AdminMyAssetsPage;
