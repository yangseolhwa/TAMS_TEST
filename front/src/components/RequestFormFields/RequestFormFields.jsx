import PropTypes from "prop-types";
import { XCircleFill } from "react-bootstrap-icons";
import styles from "./RequestFormFields.module.css";

// ─── 상수 ─────────────────────────────────────────────────────────────────────
export const ASSET_TYPES = [
  { id: "sw", label: "SW" },
  { id: "pc", label: "PC" },
];

const SW_TYPE_OPTIONS = [
  { value: "dev",           label: "개발 (dev)" },
  { value: "design",        label: "디자인 (design)" },
  { value: "collaboration", label: "협업 (collaboration)" },
  { value: "security",      label: "보안 (security)" },
  { value: "other",         label: "기타 (other)" },
];

const KEY_TYPE_OPTIONS = [
  { value: "serial",     label: "시리얼" },
  { value: "url",        label: "URL" },
  { value: "credential", label: "크리덴셜" },
  { value: "other",      label: "기타" },
];

// ─── 초기 아이템 ──────────────────────────────────────────────────────────────
export const createInitialItem = () => ({
  id:           crypto.randomUUID(),
  requestType:  "existing",  // "existing" | "new"
  assetType:    "",          // "pc" | "sw"

  // 기존 PC
  selectedCategoryId: "",
  selectedAssetId:    "",

  // 기존 SW
  selectedSwType: "",
  selectedSwId:   "",

  // 신규 PC
  assetNumber:      "",
  modelName:        "",
  categoryId:       "",
  itemTypeId:       "",
  manufacturer:     "",
  acquisitionDate:  "",
  spec:             "",
  serialNumber:     "",
  requiredQuantity: "",

  // 신규 SW
  swName:         "",
  softwareType:   "",
  swManufacturer: "",
  isSubscription: "",

  // SW 공통 (기존/신규)
  licenseKey: "",
  keyType:    "",

  // 공통 선택
  requestReason: "",
});

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
const RequestFormFields = ({
  items,
  enterpriseAssets,
  swAssets,
  onAssetTypeChange,
  onItemChange,
  onRemoveItem,
}) => {
  return (
    <>
      {items.map((item, index) => {
        // ── 카스케이딩 옵션 계산 ──────────────────────────────────────────────

        // PC: 카테고리 목록 (item_category 중복 제거)
        const pcCategories = [
          ...new Map(
            (enterpriseAssets ?? [])
              .filter((a) => a.item_category)
              .map((a) => [a.item_category.id, a.item_category])
          ).values(),
        ];

        // PC: item_type 목록 (중복 제거)
        const pcItemTypes = [
          ...new Map(
            (enterpriseAssets ?? [])
              .filter((a) => a.item_type)
              .map((a) => [a.item_type.id, a.item_type])
          ).values(),
        ];

        // PC 기존: 카테고리로 필터링된 자산 목록
        const pcAssetsFiltered = (enterpriseAssets ?? []).filter(
          (a) => !item.selectedCategoryId || String(a.item_category?.id) === item.selectedCategoryId
        );

        // SW: 보유 유형 목록
        const swTypesAvailable = [
          ...new Set((swAssets ?? []).map((s) => s.software_type).filter(Boolean)),
        ];

        // SW 기존: 유형으로 필터링된 SW 목록
        const swAssetsFiltered = (swAssets ?? []).filter(
          (s) => !item.selectedSwType || s.software_type === item.selectedSwType
        );

        return (
          <div key={item.id} className={styles.requestCard}>

            {/* ── 카드 헤더 ── */}
            <div className={styles.requestCardHeader}>
              <div className={styles.requestCardHeaderLeft}>
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
              {onRemoveItem && items.length > 1 && (
                <button
                  className={styles.removeItemBtn}
                  onClick={() => onRemoveItem(index)}
                  title="항목 삭제"
                >
                  <XCircleFill size={16} />
                  항목 삭제
                </button>
              )}
            </div>

            {/* ── 자산 유형 선택 ── */}
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
            </div>

            {/* ── 기존 PC ── */}
            {item.assetType === "pc" && item.requestType === "existing" && (
              <div className={styles.extraFields}>
                {/* 카스케이딩: 자산 종류 → 자산 */}
                <div className={styles.selectRow}>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      자산 종류 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.selectedCategoryId}
                      onChange={(e) =>
                        onItemChange(index, { selectedCategoryId: e.target.value, selectedAssetId: "" })
                      }
                    >
                      <option value="">선택</option>
                      {pcCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      자산 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.selectedAssetId}
                      disabled={!item.selectedCategoryId}
                      onChange={(e) => onItemChange(index, "selectedAssetId", e.target.value)}
                    >
                      <option value="">
                        {item.selectedCategoryId ? "선택" : "종류 먼저 선택"}
                      </option>
                      {pcAssetsFiltered.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.model_name} ({a.manufacturer})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 취득일 + 선택 필드 */}
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      취득일 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="date"
                      value={item.acquisitionDate}
                      onChange={(e) => onItemChange(index, "acquisitionDate", e.target.value)}
                    />
                  </div>
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
                      value={item.serialNumber}
                      onChange={(e) => onItemChange(index, "serialNumber", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>수량</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      placeholder="0"
                      value={item.requiredQuantity}
                      onChange={(e) => onItemChange(index, "requiredQuantity", e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>요청 사유</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="요청 사유 입력 (선택)"
                      value={item.requestReason}
                      onChange={(e) => onItemChange(index, "requestReason", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── 기존 SW ── */}
            {item.assetType === "sw" && item.requestType === "existing" && (
              <div className={styles.extraFields}>
                {/* 카스케이딩: SW 유형 → 소프트웨어 */}
                <div className={styles.selectRow}>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      SW 유형 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.selectedSwType}
                      onChange={(e) =>
                        onItemChange(index, { selectedSwType: e.target.value, selectedSwId: "" })
                      }
                    >
                      <option value="">선택</option>
                      {swTypesAvailable.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      소프트웨어 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.selectedSwId}
                      disabled={!item.selectedSwType}
                      onChange={(e) => onItemChange(index, "selectedSwId", e.target.value)}
                    >
                      <option value="">
                        {item.selectedSwType ? "선택" : "유형 먼저 선택"}
                      </option>
                      {swAssetsFiltered.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.manufacturer})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 라이선스키 + 키 유형 */}
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      라이선스키 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="라이선스키 입력"
                      value={item.licenseKey}
                      onChange={(e) => onItemChange(index, "licenseKey", e.target.value)}
                    />
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      키 유형 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.keyType}
                      onChange={(e) => onItemChange(index, "keyType", e.target.value)}
                    >
                      <option value="">선택</option>
                      {KEY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>요청 사유</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="요청 사유 입력 (선택)"
                      value={item.requestReason}
                      onChange={(e) => onItemChange(index, "requestReason", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── 신규 PC ── */}
            {item.assetType === "pc" && item.requestType === "new" && (
              <div className={styles.extraFields}>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      자산 번호 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="자산 번호 입력"
                      value={item.assetNumber}
                      onChange={(e) => onItemChange(index, "assetNumber", e.target.value)}
                    />
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      자산 종류 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.categoryId}
                      onChange={(e) => onItemChange(index, "categoryId", e.target.value)}
                    >
                      <option value="">선택</option>
                      {pcCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      자산 유형 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.itemTypeId}
                      onChange={(e) => onItemChange(index, "itemTypeId", e.target.value)}
                    >
                      <option value="">선택</option>
                      {pcItemTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      제조사 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="제조사 입력"
                      value={item.manufacturer}
                      onChange={(e) => onItemChange(index, "manufacturer", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      모델명 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="모델명 입력"
                      value={item.modelName}
                      onChange={(e) => onItemChange(index, "modelName", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      취득일 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="date"
                      value={item.acquisitionDate}
                      onChange={(e) => onItemChange(index, "acquisitionDate", e.target.value)}
                    />
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
                      value={item.serialNumber}
                      onChange={(e) => onItemChange(index, "serialNumber", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>수량</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      placeholder="0"
                      value={item.requiredQuantity}
                      onChange={(e) => onItemChange(index, "requiredQuantity", e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>요청 사유</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="요청 사유 입력 (선택)"
                      value={item.requestReason}
                      onChange={(e) => onItemChange(index, "requestReason", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── 신규 SW ── */}
            {item.assetType === "sw" && item.requestType === "new" && (
              <div className={styles.extraFields}>
                <div className={styles.selectRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      소프트웨어명 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="소프트웨어명 입력"
                      value={item.swName}
                      onChange={(e) => onItemChange(index, "swName", e.target.value)}
                    />
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      SW 유형 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.softwareType}
                      onChange={(e) => onItemChange(index, "softwareType", e.target.value)}
                    >
                      <option value="">선택</option>
                      {SW_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      제조사 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="제조사 입력"
                      value={item.swManufacturer}
                      onChange={(e) => onItemChange(index, "swManufacturer", e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      라이선스키 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="라이선스키 입력"
                      value={item.licenseKey}
                      onChange={(e) => onItemChange(index, "licenseKey", e.target.value)}
                    />
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      키 유형 <span className={styles.required}>*</span>
                    </label>
                    <select
                      className={styles.select}
                      value={item.keyType}
                      onChange={(e) => onItemChange(index, "keyType", e.target.value)}
                    >
                      <option value="">선택</option>
                      {KEY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>구독여부</label>
                    <select
                      className={styles.select}
                      value={item.isSubscription}
                      onChange={(e) => onItemChange(index, "isSubscription", e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="true">구독</option>
                      <option value="false">비구독</option>
                    </select>
                  </div>
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>요청 사유</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="요청 사유 입력 (선택)"
                      value={item.requestReason}
                      onChange={(e) => onItemChange(index, "requestReason", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

          </div>
        );
      })}
    </>
  );
};

RequestFormFields.propTypes = {
  items:             PropTypes.array.isRequired,
  enterpriseAssets:  PropTypes.array.isRequired,
  swAssets:          PropTypes.array.isRequired,
  onAssetTypeChange: PropTypes.func.isRequired,
  onItemChange:      PropTypes.func.isRequired,
  onRemoveItem:      PropTypes.func,
};

export default RequestFormFields;
