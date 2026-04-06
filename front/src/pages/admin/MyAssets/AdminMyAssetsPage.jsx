import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ClipboardPlus, ChevronDown, ChevronUp } from "react-bootstrap-icons";
import HeaderButton from "../../../components/HeaderButton/HeaderButton";
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
  { id: "request",  label: "등록 요청" },
  { id: "register", label: "자산 등록" },
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

//API 연동 시 대체 예정
const MOCK_SW_DASHBOARD = [
  {
    // 일반 케이스: 미사용 있음
    id: 1,
    name: "Office 365",
    totalCount: 10,
    activeCount: 7,
    inactiveCount: 3,
    licenses: [
      { id: 1, key: "ABCD-1234-EFGH-5678", user: "kim@company.com" },
      { id: 2, key: "IJKL-9012-MNOP-3456", user: "lee@company.com" },
      { id: 3, key: "QRST-7890-UVWX-1234", user: "park@company.com" },
      { id: 4, key: "YZAB-5678-CDEF-9012", user: "choi@company.com" },
      { id: 5, key: "GHIJ-3456-KLMN-7890", user: "jung@company.com" },
      { id: 6, key: "OPQR-1234-STUV-5678", user: "yoon@company.com" },
      { id: 7, key: "WXYZ-9012-ABCD-3456", user: "han@company.com" },
    ],
  },
  {
    // 일반 케이스: 미사용 있음
    id: 2,
    name: "Slack",
    totalCount: 20,
    activeCount: 18,
    inactiveCount: 2,
    licenses: [
      { id: 8,  key: "SLCK-1111-AAAA-0001", user: "kim@company.com" },
      { id: 9,  key: "SLCK-2222-BBBB-0002", user: "lee@company.com" },
      { id: 10, key: "SLCK-3333-CCCC-0003", user: "park@company.com" },
    ],
  },
  {
    // 미사용 = 0 케이스: '-' 표시 확인
    id: 3,
    name: "Figma",
    totalCount: 5,
    activeCount: 5,
    inactiveCount: 0,
    licenses: [
      { id: 11, key: "FGMA-AAAA-1111-ZZZZ", user: "design1@company.com" },
      { id: 12, key: "FGMA-BBBB-2222-YYYY", user: "design2@company.com" },
      { id: 13, key: "FGMA-CCCC-3333-XXXX", user: "design3@company.com" },
      { id: 14, key: "FGMA-DDDD-4444-WWWW", user: "design4@company.com" },
      { id: 15, key: "FGMA-EEEE-5555-VVVV", user: "design5@company.com" },
    ],
  },
  {
    // 라이선스 빈 배열 케이스: 빈 상태 메시지 확인
    id: 4,
    name: "Adobe XD",
    totalCount: 3,
    activeCount: 0,
    inactiveCount: 3,
    licenses: [],
  },
];

// API 연동 시 대체 예정
const MOCK_PC_DASHBOARD = [
  {
    // 일반 케이스: 미사용 있음
    id: 1,
    category: "노트북",
    totalCount: 20,
    activeCount: 17,
    inactiveCount: 3,
  },
  {
    // 일반 케이스: 미사용 있음
    id: 2,
    category: "데스크탑",
    totalCount: 10,
    activeCount: 8,
    inactiveCount: 2,
  },
  {
    // 미사용 = 0 케이스: '-' 표시 확인
    id: 3,
    category: "모니터",
    totalCount: 15,
    activeCount: 15,
    inactiveCount: 0,
  },
];

const AdminMyAssetsPage = () => {
  const navigate = useNavigate();

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

  // SW 대시보드 아코디언 상태
  const [openSwId, setOpenSwId] = useState(null);

  // 각 패널의 실제 높이 (useLayoutEffect로 측정)
  const panelRefs    = useRef({});
  const [panelHeights, setPanelHeights] = useState({});

  useLayoutEffect(() => {
    const heights = {};
    MOCK_SW_DASHBOARD.forEach((sw) => {
      const el = panelRefs.current[sw.id];
      if (el) heights[sw.id] = el.scrollHeight;
    });
    setPanelHeights(heights);
  }, []);

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
      <PageHeader
        title="내 자산 관리"
        desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요."
        actions={
          <>
            <HeaderButton label="자산 등록" onClick={() => navigate("/admin/my-assets/request")} />
            <HeaderButton label="요청 내역" onClick={() => navigate("/admin/my-assets/request-history")} />
          </>
        }
      />

      {/* 섹션 0: SW 현황 대시보드 */}
      <section className={styles.section}>
        <div className={styles.swDashboardTitleBar}>
          <span className={styles.swDashboardTitleText}>전체 SW 현황</span>
          <div className={styles.swDashboardTitleRight}>
            <span className={styles.swDashboardTitleCount}>총 {MOCK_SW_DASHBOARD.reduce((sum, sw) => sum + sw.totalCount, 0)}건</span>
            <button type="button" className={styles.swDashboardViewBtn} onClick={() => {}}>조회 &gt;</button>
          </div>
        </div>

        <Card>
          {/* 헤더 행 */}
          <div className={styles.swDashboardHeader}>
            <span className={styles.swDashboardHeaderName}>소프트웨어명</span>
            <span className={styles.swDashboardHeaderCount}>총 수량</span>
            <span className={styles.swDashboardHeaderCount}>사용 중</span>
            <span className={styles.swDashboardHeaderCount}>미사용</span>
            <span className={styles.swDashboardHeaderChevron} />
          </div>

          {/* 아코디언 목록 */}
          <ul className={styles.swDashboardList}>
            {MOCK_SW_DASHBOARD.map((sw) => {
              const isOpen = openSwId === sw.id;
              return (
                <li key={sw.id} className={styles.swDashboardItem}>
                  {/* 소프트웨어 행 */}
                  <button
                    type="button"
                    className={`${styles.swDashboardRow} ${isOpen ? styles.swDashboardRowOpen : ""}`}
                    onClick={() => setOpenSwId(isOpen ? null : sw.id)}
                  >
                    <span className={styles.swDashboardName}>{sw.name}</span>
                    <span className={styles.swDashboardCount}>{sw.totalCount}</span>
                    <span className={styles.swDashboardCount}>{sw.activeCount}</span>
                    <span className={`${styles.swDashboardCount} ${sw.inactiveCount > 0 ? styles.swDashboardCountWarning : styles.swDashboardCountZero}`}>
                      {sw.inactiveCount > 0 ? sw.inactiveCount : "-"}
                    </span>
                    <span className={`${styles.swDashboardChevron} ${isOpen ? styles.swDashboardChevronOpen : ""}`}>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {/* 펼쳐지는 라이선스 목록 */}
                  <div
                    ref={el => panelRefs.current[sw.id] = el}
                    className={`${styles.swLicensePanel} ${isOpen ? styles.swLicensePanelOpen : ""}`}
                    style={{ maxHeight: isOpen ? (panelHeights[sw.id] ?? 0) + 'px' : '0px' }}
                  >
                    {sw.licenses.length === 0 ? (
                      <p className={styles.swLicenseEmpty}>사용 중인 라이선스가 없습니다.</p>
                    ) : (
                      <table className={styles.swLicenseTable}>
                        <thead>
                          <tr>
                            <th>라이선스 키</th>
                            <th>사용자</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sw.licenses.map((license) => (
                            <tr key={license.id}>
                              <td>{license.key}</td>
                              <td>{license.user}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {/* 섹션 0-1: PC 현황 대시보드 */}
      <section className={styles.section}>
        <div className={styles.swDashboardTitleBar}>
          <span className={styles.swDashboardTitleText}>전체 PC 현황</span>
          <div className={styles.swDashboardTitleRight}>
            <span className={styles.swDashboardTitleCount}>총 {MOCK_PC_DASHBOARD.reduce((sum, pc) => sum + pc.totalCount, 0)}건</span>
            <button type="button" className={styles.swDashboardViewBtn} onClick={() => {}}>조회 &gt;</button>
          </div>
        </div>

        <Card>
          {/* 헤더 행 */}
          <div className={styles.pcDashboardHeader}>
            <span className={styles.swDashboardHeaderName}>자산 종류</span>
            <span className={styles.swDashboardHeaderCount}>총 수량</span>
            <span className={styles.swDashboardHeaderCount}>사용 중</span>
            <span className={styles.swDashboardHeaderCount}>미사용</span>
          </div>

          {/* 목록 */}
          <ul className={styles.swDashboardList}>
            {MOCK_PC_DASHBOARD.map((pc) => (
              <li key={pc.id} className={styles.swDashboardItem}>
                <div className={styles.pcDashboardRow}>
                  <span className={styles.swDashboardName}>{pc.category}</span>
                  <span className={styles.swDashboardCount}>{pc.totalCount}</span>
                  <span className={styles.swDashboardCount}>{pc.activeCount}</span>
                  <span className={`${styles.swDashboardCount} ${pc.inactiveCount > 0 ? styles.swDashboardCountWarning : styles.swDashboardCountZero}`}>
                    {pc.inactiveCount > 0 ? pc.inactiveCount : "-"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>


    </div>
  );
};

export default AdminMyAssetsPage;
