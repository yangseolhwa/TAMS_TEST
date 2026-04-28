import { useMemo } from "react";
import PropTypes from "prop-types";
import { XCircleFill } from "react-bootstrap-icons";
import styles from "./RequestFormFields.module.css";

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const DIRECT_INPUT = "__direct__";

export const ASSET_TYPES = [
  { id: "pc", label: "PC" },
  { id: "sw", label: "SW" },
];

const KEY_TYPE_OPTIONS = [
  { value: "serial",     label: "시리얼" },
  { value: "credential", label: "크리덴셜" },
];

const LICENSE_TYPE_OPTIONS = [
  { value: "per_seat", label: "개인 전용" },
  { value: "shared",   label: "공유" },
];

// ─── 초기 아이템 ──────────────────────────────────────────────────────────────
export const createInitialItem = () => ({
  id:        crypto.randomUUID(),
  assetType: "",

  // PC
  categoryId:       "",
  itemTypeId:       "",       // "__direct__" 포함
  itemTypeName:     "",       // 직접 입력값
  manufacturer:     "",       // 셀렉트 선택값 (문자열) 또는 "__direct__"
  manufacturerName: "",       // 직접 입력값
  acquisitionDate:  new Date().toISOString().slice(0, 10),
  spec:             "",
  serialNumber:     "",
  remarks:          "",

  // SW 메타데이터
  swId:               "",     // "__direct__" 포함
  swName:             "",     // 직접 입력값
  swManufacturer:     "",     // 셀렉트 선택값 (문자열) 또는 "__direct__"
  swManufacturerName: "",     // 직접 입력값
  version:            "",
  acquisitionDateSw:  new Date().toISOString().slice(0, 10),
  quantity:           "",
  swRemarks:          "",     // SW 메타데이터 비고

  // SW 라이선스
  licenseKey:      "",
  keyType:         "",
  licenseType:     "per_seat",
  licensePassword: "",        // keyType === "credential" 일 때만 전송
  relatedLink:     "",

  // 공통
  requestReason: "",
});

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
const RequestFormFields = ({
  items,
  enterpriseAssets,
  swAssets,
  onAssetTypeChange,
  onItemChange,
  onRemoveItem,
}) => {
  // PC: 카테고리 목록 (중복 제거)
  const pcCategories = useMemo(() => [
    ...new Map(
      (enterpriseAssets ?? [])
        .filter((a) => a.item_category)
        .map((a) => [a.item_category.id, a.item_category])
    ).values(),
  ], [enterpriseAssets]);

  // PC: item_type 목록 (중복 제거)
  const pcItemTypes = useMemo(() => [
    ...new Map(
      (enterpriseAssets ?? [])
        .filter((a) => a.item_type)
        .map((a) => [a.item_type.id, a.item_type])
    ).values(),
  ], [enterpriseAssets]);

  // SW: 전체 제조사 목록 (중복 제거)
  const swManufacturers = useMemo(() => [
    ...new Set((swAssets ?? []).map((s) => s.manufacturer).filter(Boolean)),
  ], [swAssets]);

  return (
    <>
      {items.map((item, index) => {
        // PC: 선택한 자산 유형에 속한 제조사 목록
        const pcManufacturers = [
          ...new Set(
            (enterpriseAssets ?? [])
              .map((a) => a.manufacturer)
              .filter(Boolean)
          ),
        ];

        // SW: 선택한 SW 찾기 (제조사 자동 채움용)
        const selectedSw = (swAssets ?? []).find(
          (s) => String(s.id) === item.swId
        );

        return (
          <div key={item.id} className={styles.requestCard}>

            {/* ── 카드 헤더 ── */}
            <div className={styles.requestCardHeader}>
              <span className={styles.requestCardTitle}>요청 항목 {index + 1}</span>
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

            {/* ── PC 폼 ── */}
            {item.assetType === "pc" && (
              <div className={styles.extraFields}>

                {/* Row 1: 카테고리 + 자산 유형 */}
                <div className={styles.selectRow}>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      카테고리 <span className={styles.required}>*</span>
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
                    {item.itemTypeId === DIRECT_INPUT ? (
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="자산 유형 직접 입력"
                        value={item.itemTypeName}
                        autoFocus
                        onChange={(e) => onItemChange(index, "itemTypeName", e.target.value)}
                      />
                    ) : (
                      <select
                        className={styles.select}
                        value={item.itemTypeId}
                        onChange={(e) =>
                          // 자산 유형 변경 시 제조사 초기화
                          onItemChange(index, {
                            itemTypeId:       e.target.value,
                            itemTypeName:     "",
                            manufacturer:     "",
                            manufacturerName: "",
                          })
                        }
                      >
                        <option value="">선택</option>
                        {pcItemTypes.map((type) => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                        <option value={DIRECT_INPUT}>직접 입력...</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Row 2: 제조사 + 취득일 */}
                <div className={styles.inputRow}>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      제조사 <span className={styles.required}>*</span>
                    </label>
                    {item.manufacturer === DIRECT_INPUT ? (
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="제조사 직접 입력"
                        value={item.manufacturerName}
                        autoFocus
                        onChange={(e) => onItemChange(index, "manufacturerName", e.target.value)}
                      />
                    ) : (
                      <select
                        className={styles.select}
                        value={item.manufacturer}
                        onChange={(e) =>
                          onItemChange(index, {
                            manufacturer:     e.target.value,
                            manufacturerName: "",
                          })
                        }
                      >
                        <option value="">선택</option>
                        {pcManufacturers.map((mfr) => (
                          <option key={mfr} value={mfr}>{mfr}</option>
                        ))}
                        <option value={DIRECT_INPUT}>직접 입력...</option>
                      </select>
                    )}
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

                {/* Row 3: 규격 + 시리얼 번호 + 비고 + 요청 사유 */}
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
                    <label className={styles.selectLabel}>비고</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="비고 입력"
                      value={item.remarks}
                      onChange={(e) => onItemChange(index, "remarks", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>요청 사유</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="요청 사유 입력"
                      value={item.requestReason}
                      onChange={(e) => onItemChange(index, "requestReason", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── SW 폼 ── */}
            {item.assetType === "sw" && (
              <div className={styles.extraFields}>

                {/* Row 1: 소프트웨어 + 제조사 */}
                <div className={styles.selectRow}>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      소프트웨어 <span className={styles.required}>*</span>
                    </label>
                    {item.swId === DIRECT_INPUT ? (
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="소프트웨어명 직접 입력"
                        value={item.swName}
                        autoFocus
                        onChange={(e) => onItemChange(index, "swName", e.target.value)}
                      />
                    ) : (
                      <select
                        className={styles.select}
                        value={item.swId}
                        onChange={(e) => {
                          const selected = (swAssets ?? []).find(
                            (s) => String(s.id) === e.target.value
                          );
                          onItemChange(index, {
                            swId:               e.target.value,
                            swName:             "",
                            // 기존 SW 선택 시 제조사 자동 채움
                            swManufacturer:     selected?.manufacturer ?? "",
                            swManufacturerName: "",
                          });
                        }}
                      >
                        <option value="">선택</option>
                        {(swAssets ?? []).map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                        <option value={DIRECT_INPUT}>직접 입력...</option>
                      </select>
                    )}
                  </div>

                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>
                      제조사 <span className={styles.required}>*</span>
                    </label>
                    {item.swManufacturer === DIRECT_INPUT ? (
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="제조사 직접 입력"
                        value={item.swManufacturerName}
                        autoFocus
                        onChange={(e) => onItemChange(index, "swManufacturerName", e.target.value)}
                      />
                    ) : (
                      <select
                        className={styles.select}
                        value={item.swManufacturer}
                        onChange={(e) =>
                          onItemChange(index, {
                            swManufacturer:     e.target.value,
                            swManufacturerName: "",
                          })
                        }
                      >
                        <option value="">선택</option>
                        {/* 기존 SW 선택 시 해당 제조사만, 신규면 전체 목록 */}
                        {(selectedSw
                          ? [selectedSw.manufacturer].filter(Boolean)
                          : swManufacturers
                        ).map((mfr) => (
                          <option key={mfr} value={mfr}>{mfr}</option>
                        ))}
                        <option value={DIRECT_INPUT}>직접 입력...</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Row 2: 버전 + 취득일 + 수량 */}
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>버전</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="버전 입력"
                      value={item.version}
                      onChange={(e) => onItemChange(index, "version", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>취득일</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={item.acquisitionDateSw}
                      onChange={(e) => onItemChange(index, "acquisitionDateSw", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>수량</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) => onItemChange(index, "quantity", e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 3: 라이선스 키 + 키 유형 + 라이선스 타입 */}
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>
                      라이선스 키 <span className={styles.required}>*</span>
                    </label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="라이선스 키 입력"
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
                      onChange={(e) =>
                        // 시리얼로 변경 시 비밀번호 초기화
                        onItemChange(index, {
                          keyType:         e.target.value,
                          licensePassword: "",
                        })
                      }
                    >
                      <option value="">선택</option>
                      {KEY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.selectGroup}>
                    <label className={styles.selectLabel}>라이선스 타입</label>
                    <select
                      className={styles.select}
                      value={item.licenseType}
                      onChange={(e) => onItemChange(index, "licenseType", e.target.value)}
                    >
                      {LICENSE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 4: 라이선스 비밀번호 — 크리덴셜 선택 시만 표시 */}
                {item.keyType === "credential" && (
                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup}>
                      <label className={styles.selectLabel}>라이선스 비밀번호</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="라이선스 비밀번호 입력"
                        value={item.licensePassword}
                        onChange={(e) => onItemChange(index, "licensePassword", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Row 5: 관련 링크 + 비고 + 요청 사유 */}
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>관련 링크</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="관련 링크 입력"
                      value={item.relatedLink}
                      onChange={(e) => onItemChange(index, "relatedLink", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>비고</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="비고 입력"
                      value={item.swRemarks}
                      onChange={(e) => onItemChange(index, "swRemarks", e.target.value)}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.selectLabel}>요청 사유</label>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="요청 사유 입력"
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
