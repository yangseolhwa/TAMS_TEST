import { useState } from "react";
import { PlusCircleFill } from "react-bootstrap-icons";
import Banner from "../../../components/Banner/Banner";
import TabCard from "../../../components/TabCard/TabCard";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, { createInitialItem } from "../../../components/RequestFormFields/RequestFormFields";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
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

const MAX_ITEMS = 5;

const INNER_TABS = [
  { id: "request", label: "자산 등록 요청" },
  { id: "status", label: "자산 요청 현황" },
];

const UserMyAssetsPage = () => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [rows, setRows] = useState([]); // API 연동 전 빈 배열  
  const [activeTab, setActiveTab] = useState(INNER_TABS[0].id);
  const [items, setItems] = useState([createInitialItem()]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  return (
    <div className={styles.page}>
      <PageHeader
        title="내 자산 관리"
        desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요."
      />

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

      <ConfirmModal
        isOpen={showResetConfirm}
        title="입력 내용을 초기화할까요?"
        desc="작성한 모든 항목이 삭제되고 초기 상태로 돌아갑니다."
        confirmLabel="초기화"
        confirmVariant="danger"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />

    </div>
  );
};

export default UserMyAssetsPage;