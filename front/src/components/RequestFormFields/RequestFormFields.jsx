import { PlusCircleFill, DashCircleFill } from "react-bootstrap-icons";
import styles from "./RequestFormFields.module.css";

export const ASSET_TYPES = [
  { id: "sw", label: "SW" },
  { id: "pc", label: "PC" },
];

export const ASSET_CATEGORIES = {
  sw: [],  // API 연동 시 채울 예정
  pc: [],  // API 연동 시 채울 예정
};

export const createInitialItem = () => ({
  id: crypto.randomUUID(),
  requestType: "existing",
  assetType: "",
  assetCategory: "",
  manufacturer: "",
  modelName: "",
  spec: "",
  serial: "",
  quantity: "",
  swManufacturer: "",
  swName: "",
  subscription: "",
  requiredQuantity: "",
  licenseKeys: [""],
});

const RequestFormFields = ({
  items,
  onAssetTypeChange,
  onAssetCategoryChange,
  onItemChange,
  onAddLicenseKey,
  onRemoveLicenseKey,
  onLicenseKeyChange,
}) => {
  return (
    <>
      {items.map((item, index) => (
        <div key={item.id} className={styles.requestCard}>
          <div className={styles.requestCardHeader}>
            <span className={styles.requestCardTitle}>요청 항목 {index + 1}</span>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`requestType-${index}`}
                  value="existing"
                  checked={item.requestType === "existing"}
                  onChange={(e) => onItemChange(index, "requestType", e.target.value)}
                />
                기존 자산
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`requestType-${index}`}
                  value="new"
                  checked={item.requestType === "new"}
                  onChange={(e) => onItemChange(index, "requestType", e.target.value)}
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
                onChange={(e) => onAssetTypeChange(index, e.target.value)}
              >
                <option value="">선택</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
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
                onChange={(e) => onAssetCategoryChange(index, e.target.value)}
                disabled={!item.assetType}
              >
                <option value="">
                  {item.assetType ? "선택" : "유형 먼저 선택"}
                </option>
                {item.assetType &&
                  ASSET_CATEGORIES[item.assetType].map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))
                }
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
                    onChange={(e) => onItemChange(index, "manufacturer", e.target.value)}
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
                    onChange={(e) => onItemChange(index, "modelName", e.target.value)}
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
                    onChange={(e) => onItemChange(index, "spec", e.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.selectLabel}>시리얼 번호</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="시리얼 번호 입력"
                    value={item.serial}
                    onChange={(e) => onItemChange(index, "serial", e.target.value)}
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
                    onChange={(e) => onItemChange(index, "quantity", e.target.value)}
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
                    onChange={(e) => onItemChange(index, "swManufacturer", e.target.value)}
                  >
                    <option value="">선택</option>
                  </select>
                </div>
                <div className={styles.selectGroup}>
                  <label className={styles.selectLabel}>
                    소프트웨어명 <span className={styles.required}>*</span>
                  </label>
                  <select
                    className={styles.select}
                    value={item.swName}
                    onChange={(e) => onItemChange(index, "swName", e.target.value)}
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
                    onChange={(e) => onItemChange(index, "subscription", e.target.value)}
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
                    onChange={(e) => onItemChange(index, "requiredQuantity", e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.licenseKeyGroup}>
                <div className={styles.licenseKeyHeader}>
                  <label className={styles.selectLabel}>라이선스키</label>
                  <button
                    className={styles.addKeyBtn}
                    onClick={() => onAddLicenseKey(index)}
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
                      onChange={(e) => onLicenseKeyChange(index, keyIndex, e.target.value)}
                    />
                    {keyIndex >= 1 && (
                      <button
                        className={styles.removeKeyBtn}
                        onClick={() => onRemoveLicenseKey(index, keyIndex)}
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
  );
};

export default RequestFormFields;