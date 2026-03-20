import { useState } from "react";
import {
  InfoCircleFill,
  PlusCircleFill,
  DashCircleFill,
} from "react-bootstrap-icons";
import styles from "./UserMyAssetsPage.module.css";

const INNER_TABS = [
  { id: "request", label: "자산 등록 요청" },
  { id: "status", label: "자산 요청 현황" },
];

const ASSET_TYPES = [
  { id: "sw", label: "SW" },
  { id: "pc", label: "PC" },
];

const ASSET_CATEGORIES = {
  sw: [], // API 연동 시 채울 예정
  pc: [], // API 연동 시 채울 예정
};

const createInitialItem = () => ({
  requestType: "existing",
  assetType: "",
  assetCategory: "",
  // PC 필드
  manufacturer: "",
  modelName: "",
  spec: "",
  serial: "",
  quantity: "",
  // SW 필드
  swManufacturer: "",
  swName: "",
  subscription: "",
  requiredQuantity: "",
  licenseKeys: [""],
});

const UserMyAssetsPage = () => {
  const [activeTab, setActiveTab] = useState(INNER_TABS[0].id);
  const [items, setItems] = useState([createInitialItem()]);

  const today = new Date();
  const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  const handleAssetTypeChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...createInitialItem(), assetType: value } : item,
      ),
    );
  };

  const handleAssetCategoryChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, assetCategory: value } : item,
      ),
    );
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleAddLicenseKey = (index) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, licenseKeys: [...item.licenseKeys, ""] }
          : item,
      ),
    );
  };

  const handleRemoveLicenseKey = (itemIndex, keyIndex) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              licenseKeys: item.licenseKeys.filter((_, j) => j !== keyIndex),
            }
          : item,
      ),
    );
  };

  const handleLicenseKeyChange = (itemIndex, keyIndex, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? {
              ...item,
              licenseKeys: item.licenseKeys.map((key, j) =>
                j === keyIndex ? value : key,
              ),
            }
          : item,
      ),
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>내 자산 관리</h1>
          <p className={styles.pageDesc}>
            소프트웨어 및 PC 장비 자산을 조회하고 관리하세요.
          </p>
        </div>
        <span className={styles.pageDate}>{formattedDate} 기준</span>
      </div>

      <div className={styles.card}>
        <div className={styles.innerTabs}>
          {INNER_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.innerTab} ${activeTab === tab.id ? styles.innerTabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {activeTab === INNER_TABS[0].id && (
            <>
              <div className={styles.banner}>
                <InfoCircleFill className={styles.bannerIcon} />
                <p className={styles.bannerText}>
                  소프트웨어 및 PC 장비를 최대 <strong>5개</strong>까지 동시에
                  요청할 수 있습니다. 처리 상태는{" "}
                  <strong>자산 요청 현황</strong>에서 확인하세요.
                </p>
              </div>

              {items.map((item, index) => (
                <div key={index} className={styles.requestCard}>
                  <div className={styles.requestCardHeader}>
                    <span className={styles.requestCardTitle}>
                      요청 항목 {index + 1}
                    </span>
                    <div className={styles.radioGroup}>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name={`requestType-${index}`}
                          value="existing"
                          checked={item.requestType === "existing"}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "requestType",
                              e.target.value,
                            )
                          }
                        />
                        기존 자산
                      </label>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name={`requestType-${index}`}
                          value="new"
                          checked={item.requestType === "new"}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "requestType",
                              e.target.value,
                            )
                          }
                        />
                        신규 자산
                      </label>
                    </div>
                  </div>

                  <div className={styles.selectRow}>
                    <div className={styles.selectGroup}>
                      <label className={styles.selectLabel}>
                        자산 유형 <span className={styles.required}>*</span>
                      </label>
                      <select
                        className={styles.select}
                        value={item.assetType}
                        onChange={(e) =>
                          handleAssetTypeChange(index, e.target.value)
                        }
                      >
                        <option value="">선택</option>
                        {ASSET_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.selectGroup}>
                      <label className={styles.selectLabel}>
                        자산 종류 <span className={styles.required}>*</span>
                      </label>
                      <select
                        className={styles.select}
                        value={item.assetCategory}
                        onChange={(e) =>
                          handleAssetCategoryChange(index, e.target.value)
                        }
                        disabled={!item.assetType}
                      >
                        <option value="">
                          {item.assetType ? "선택" : "유형 먼저 선택"}
                        </option>
                        {item.assetType &&
                          ASSET_CATEGORIES[item.assetType].map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* PC 추가 필드 */}
                  {item.assetType === "pc" && (
                    <div className={styles.extraFields}>
                      <div className={styles.selectRow}>
                        <div className={styles.selectGroup}>
                          <label className={styles.selectLabel}>
                            제조사 <span className={styles.required}>*</span>
                          </label>
                          <select
                            className={styles.select}
                            value={item.manufacturer}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "manufacturer",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">선택</option>
                          </select>
                        </div>
                        <div className={styles.selectGroup}>
                          <label className={styles.selectLabel}>
                            모델명 <span className={styles.required}>*</span>
                          </label>
                          <select
                            className={styles.select}
                            value={item.modelName}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "modelName",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">선택</option>
                          </select>
                        </div>
                      </div>
                      <div className={styles.inputRow}>
                        <div className={styles.inputGroup}>
                          <label className={styles.selectLabel}>규격</label>
                          <input
                            className={styles.input}
                            type="text"
                            placeholder="규격 입력"
                            value={item.spec}
                            onChange={(e) =>
                              handleItemChange(index, "spec", e.target.value)
                            }
                          />
                        </div>
                        <div className={styles.inputGroup}>
                          <label className={styles.selectLabel}>
                            시리얼 번호
                          </label>
                          <input
                            className={styles.input}
                            type="text"
                            placeholder="시리얼 번호 입력"
                            value={item.serial}
                            onChange={(e) =>
                              handleItemChange(index, "serial", e.target.value)
                            }
                          />
                        </div>
                        <div className={styles.inputGroup}>
                          <label className={styles.selectLabel}>
                            수량 <span className={styles.required}>*</span>
                          </label>
                          <input
                            className={styles.input}
                            type="number"
                            placeholder="0"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SW 추가 필드 */}
                  {item.assetType === "sw" && (
                    <div className={styles.extraFields}>
                      <div className={styles.selectRow}>
                        <div className={styles.selectGroup}>
                          <label className={styles.selectLabel}>
                            제조사 <span className={styles.required}>*</span>
                          </label>
                          <select
                            className={styles.select}
                            value={item.swManufacturer}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "swManufacturer",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">선택</option>
                          </select>
                        </div>
                        <div className={styles.selectGroup}>
                          <label className={styles.selectLabel}>
                            소프트웨어명{" "}
                            <span className={styles.required}>*</span>
                          </label>
                          <select
                            className={styles.select}
                            value={item.swName}
                            onChange={(e) =>
                              handleItemChange(index, "swName", e.target.value)
                            }
                          >
                            <option value="">선택</option>
                          </select>
                        </div>
                        <div className={styles.selectGroup}>
                          <label className={styles.selectLabel}>
                            구독여부 <span className={styles.required}>*</span>
                          </label>
                          <select
                            className={styles.select}
                            value={item.subscription}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "subscription",
                                e.target.value,
                              )
                            }
                          >
                            <option value="">선택</option>
                            <option value="yes">구독</option>
                            <option value="no">비구독</option>
                          </select>
                        </div>
                      </div>
                      <div className={styles.inputRow}>
                        <div className={styles.inputGroup}>
                          <label className={styles.selectLabel}>
                            필요수량 <span className={styles.required}>*</span>
                          </label>
                          <input
                            className={styles.input}
                            type="number"
                            placeholder="0"
                            min="1"
                            value={item.requiredQuantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "requiredQuantity",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className={styles.licenseKeyGroup}>
                        <div className={styles.licenseKeyHeader}>
                          <label className={styles.selectLabel}>
                            라이선스키
                          </label>
                          <button
                            className={styles.addKeyBtn}
                            onClick={() => handleAddLicenseKey(index)}
                          >
                            <PlusCircleFill size={18} />
                          </button>
                        </div>
                        {item.licenseKeys.map((key, keyIndex) => (
                          <div key={keyIndex} className={styles.licenseKeyRow}>
                            <input
                              className={styles.input}
                              type="text"
                              placeholder="라이선스키 입력"
                              value={key}
                              onChange={(e) =>
                                handleLicenseKeyChange(
                                  index,
                                  keyIndex,
                                  e.target.value,
                                )
                              }
                            />
                            {keyIndex >= 1 && (
                              <button
                                className={styles.removeKeyBtn}
                                onClick={() =>
                                  handleRemoveLicenseKey(index, keyIndex)
                                }
                              >
                                <DashCircleFill size={18} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {activeTab === INNER_TABS[1].id && <p>자산 요청 현황 영역</p>}
        </div>
      </div>
    </div>
  );
};

export default UserMyAssetsPage;
