import { useState } from "react";
import { Search } from "react-bootstrap-icons";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import PageHeader from "../../../components/PageHeader/PageHeader";
import ActionButton from "../../../components/ActionButton/ActionButton";
import BackButton from "../../../components/BackButton/BackButton";
import common from "../AssetPage.common.module.css";
import styles from "./AdminSwAssetsPage.module.css";

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const SW_COLUMNS = [
  { key: "no",           label: "No" },
  { key: "productName",  label: "제품명",   type: "dash" },
  { key: "version",      label: "버전",     type: "dash" },
  { key: "licenseKey",   label: "라이선스", type: "dash" },
  { key: "manufacturer", label: "제조사",   type: "dash" },
  { key: "user",         label: "사용자",   type: "dash" },
  { key: "usedCount",    label: "사용수량", type: "dash" },
  { key: "remainCount",  label: "남은수량", type: "dash" },
  { key: "state",        label: "상태",     type: "status" },
];

const SW_STATUS_MAP = {
  available: { label: "사용가능", color: "blue"  },
  active:    { label: "사용중",   color: "green" },
};

// API 연동 시 대체 예정
const MOCK_PRODUCT_OPTIONS = ["Office 365", "Slack", "Figma", "Adobe XD"];
const MOCK_MFR_OPTIONS     = ["Microsoft", "Salesforce", "Adobe", "AhnLab"];
const MOCK_USER_OPTIONS    = ["김철수", "이영희", "박민준"];

const EMPTY_FILTER = {
  product: "",
  mfr:     "",
  user:    "",
  keyword: "",
};

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
const AdminSwAssetsPage = () => {
  const [filterForm,     setFilterForm]     = useState(EMPTY_FILTER);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTER);

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

  return (
    <div className={common.page}>
      <PageHeader title="SW 전체 조회" 
      desc={<BackButton label="내 자산 관리" to="/admin/my-assets" />}
      />

      <section className={common.section}>
        <Card>
          {/* 필터 영역 */}
          <div className={common.filterArea}>
            <select
              className={common.filterSelect}
              value={filterForm.product}
              onChange={(e) => handleFilterChange("product", e.target.value)}
            >
              <option value="">제품명 전체</option>
              {MOCK_PRODUCT_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
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
              value={filterForm.user}
              onChange={(e) => handleFilterChange("user", e.target.value)}
            >
              <option value="">사용자 전체</option>
              {MOCK_USER_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
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

          <DataTable
            columns={SW_COLUMNS}
            rows={[]}
            statusMap={SW_STATUS_MAP}
            selectable={false}
            selectedIds={[]}
            onSelectionChange={() => {}}
            totalCount={0}
            highlight={appliedFilters.keyword}
          />
        </Card>
      </section>
    </div>
  );
};

export default AdminSwAssetsPage;
