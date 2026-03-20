import { useState } from "react";
import { PlusCircleFill } from "react-bootstrap-icons";
import Banner from "../../../components/Banner/Banner";
import TabCard from "../../../components/TabCard/TabCard";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, { createInitialItem } from "../../../components/RequestFormFields/RequestFormFields";
import styles from "./UserMyAssetsPage.module.css";

const MAX_ITEMS = 5;

const INNER_TABS = [
  { id: "request", label: "자산 등록 요청" },
  { id: "status", label: "자산 요청 현황" },
];

const UserMyAssetsPage = () => {
  const [activeTab, setActiveTab] = useState(INNER_TABS[0].id);
  const [items, setItems] = useState([createInitialItem()]);

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

            {items.length < MAX_ITEMS && (
              <button className={styles.addItemBtn} onClick={handleAddItem}>
                <PlusCircleFill size={15} />
                항목 추가 ({items.length} / {MAX_ITEMS})
              </button>
            )}
          </>
        )}
        {activeTab === INNER_TABS[1].id && <p>자산 요청 현황 영역</p>}
      </TabCard>
    </div>
  );
};

export default UserMyAssetsPage;