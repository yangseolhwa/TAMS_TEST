import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search } from "react-bootstrap-icons";
import ActionButton from "../../../components/ActionButton/ActionButton";
import toast from "react-hot-toast";
import PageHeader from "../../../components/PageHeader/PageHeader";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import Card from "../../../components/Card/Card";
import styles from "./UserMyAssetsPage.module.css";
import DataTable from "../../../components/DataTable/DataTable";
import {
  fetchPersonalAssets,
  fetchEnterpriseCategories,
  moveEnterpriseAssets,
  moveSwAssets,
  returnEnterpriseAssets,
  returnSwAssets,
} from "../../../services/assetService";

// 자산 현황 탭용 컬럼
const ASSET_LIST_COMMON_COLUMNS = [
  { key: "no",                 label: "No" },
  { key: "asset_type_label",   label: "자산 유형",   type: "assetType" },
  { key: "item_category_name", label: "자산 종류",   type: "dash" },
  { key: "asset_name",         label: "자산명",       type: "dash" },
  { key: "manufacturer",       label: "제조사",       type: "dash" },
  { key: "location",           label: "위치",         type: "dash" },
  { key: "state",              label: "상태",         type: "status" },
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

const UserMyAssetsPage = () => {
  const navigate = useNavigate();

  // --- [State] ---
  const [listSelectedIds, setListSelectedIds] = useState([]); // 내 자산 조회 선택

  // 필터 상태
  const [filterType,     setFilterType]     = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterState,    setFilterState]    = useState("");
  const [filterKeyword,  setFilterKeyword]  = useState("");
  const [queryParams,    setQueryParams]    = useState({});

  // 모달 상태
  const [showReturnConfirm,    setShowReturnConfirm]    = useState(false);
  const [showMoveConfirm,      setShowMoveConfirm]      = useState(false);
  const [showNoSelectionModal, setShowNoSelectionModal] = useState(false);

  // 이동 모드 상태
  const [isMoveMode,    setIsMoveMode]    = useState(false);
  const [locationEdits, setLocationEdits] = useState({}); // { [rowId]: string }

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
      <PageHeader
        title="내 자산 현황"
        desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요."
      />

      {/* 섹션: 내 자산 조회 */}
      <section className={styles.section}>
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

            <ActionButton variant="white" size="sm" label="초기화" onClick={handleFilterReset} />

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
                <ActionButton variant="white" size="sm" label="취소" onClick={cancelMoveMode} />
                <ActionButton variant="blue"  size="sm" label="저장" onClick={handleMoveSaveClick} disabled={moveMutation.isPending} />
              </>
            ) : (
              <>
                <ActionButton variant="black" size="sm" label="상태 변경" />
                <ActionButton variant="blue"  size="sm" label="자산 이동"  onClick={handleMoveClick} />
                <ActionButton variant="red"   size="sm" label="반납 요청"  onClick={handleReturnClick} />
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
