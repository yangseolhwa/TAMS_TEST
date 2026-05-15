import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { XSquareFill, PlusSquareFill, InfoCircleFill, ChevronDown, ChevronUp } from "react-bootstrap-icons";
import { fetchEnterpriseAssetsForForm, fetchSwAssetsForForm } from "../../services/assetService";
import styles from "./RequestFormFields.module.css";

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const DIRECT_INPUT = "__direct__";

export const ASSET_TYPES = [
  { id: "pc", label: "PC" },
  { id: "sw", label: "SW" },
];

const CATEGORY_NAME_MAP = {
  furniture:  '가구',
  office:     '사무',
  industrial: '산업',
  electrical: '전기',
}

const KEY_TYPE_OPTIONS = [
  { value: "serial",     label: "제품키" },
  { value: "credential", label: "계정형" },
];

// ─── 초기 아이템 ──────────────────────────────────────────────────────────────
export const createInitialItem = () => ({
  id:        crypto.randomUUID(),
  assetType: "",

  // PC
  categoryId:       "",
  itemTypeId:       "",
  itemTypeName:     "",
  manufacturer:     "",
  manufacturerName: "",
  acquisitionDate:  new Date().toISOString().slice(0, 10),
  spec:             "",
  serialNumber:     "",
  remarks:          "",

  // SW 메타데이터
  swName:             "",       // 콤보박스 선택값 또는 "__direct__"
  swNameDirect:       "",       // 직접 입력값
  swManufacturer:     "",       // 콤보박스 선택값 또는 "__direct__"
  swManufacturerName: "",       // 직접 입력값
  version:            "",       // 콤보박스 선택값 또는 "__direct__"
  versionName:        "",       // 직접 입력값
  acquisitionDateSw:  new Date().toISOString().slice(0, 10),
  licenseRequired:    true,     // true: 라이선스형, false: 구독형
  quantity:           "",       // 구독형일 때 사용
  swRemarks:          "",

  // SW 라이선스
  licenseKeys:     [{ id: crypto.randomUUID(), value: "" }],  // 라이선스 키 배열
  keyType:         "serial",
  licenseType:     "per_seat",
  licensePassword: "",
  relatedLink:     "",

  // 공통
  requestReason: "",
});

// ─── SW 라이선스 섹션 (토글) ─────────────────────────────────────────────────
const SwLicenseSection = ({ item, index, onItemChange }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleAddKey = () => {
    onItemChange(index, {
      licenseKeys: [
        ...item.licenseKeys,
        { id: crypto.randomUUID(), value: "" },
      ],
    });
  };

  const handleRemoveKey = (keyId) => {
    onItemChange(index, {
      licenseKeys: item.licenseKeys.filter((k) => k.id !== keyId),
    });
  };

  const handleKeyChange = (keyId, value) => {
    onItemChange(index, {
      licenseKeys: item.licenseKeys.map((k) =>
        k.id === keyId ? { ...k, value } : k
      ),
    });
  };

  return (
    <div className={styles.licenseToggleWrapper}>
      {/* 토글 버튼 */}
      <button
        type="button"
        className={styles.licenseToggleBtn}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>라이선스 입력</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* 라이선스 그룹 (토글 시 표시) */}
      {isOpen && (
        <div className={styles.licenseGroup}>
          {/* 키 유형 (라디오버튼) */}
          <div className={styles.inputGroup}>
            <label className={styles.selectLabel}>
              키 유형 <span className={styles.required}>*</span>
              <InfoCircleFill
                size={13}
                style={{ color: 'var(--color-accent)', marginLeft: 4, cursor: 'default', flexShrink: 0 }}
                title="제품키: 시리얼 번호 또는 라이선스 키&#10;계정형: 아이디/비밀번호 형태의 계정 정보"
              />
            </label>
            <div className={styles.radioGroup}>
              {KEY_TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name={`keyType-${item.id}`}
                    value={opt.value}
                    checked={item.keyType === opt.value}
                    onChange={() =>
                      onItemChange(index, {
                        keyType:         opt.value,
                        licensePassword: "",
                        // 크리덴셜로 변경 시 라이선스 키를 1개로 초기화
                        licenseKeys: opt.value === "credential"
                          ? [{ id: crypto.randomUUID(), value: "" }]
                          : item.licenseKeys,
                      })
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.selectLabel}>라이선스 유형</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`licenseType-${item.id}`}
                  value="per_seat"
                  checked={item.licenseType === 'per_seat'}
                  onChange={() =>
                    onItemChange(index, { licenseType: 'per_seat' })
                  }
                />
                개인
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`licenseType-${item.id}`}
                  value="shared"
                  checked={item.licenseType === 'shared'}
                  onChange={() =>
                    onItemChange(index, {
                      licenseType:  'shared',
                      licenseKeys:  [{ id: crypto.randomUUID(), value: '' }],
                    })
                  }
                />
                공용
              </label>
            </div>
          </div>

          {/* 라이선스 키 목록 */}
          <div className={styles.inputGroup}>
            <label className={styles.selectLabel}>
              라이선스 키 <span className={styles.required}>*</span>
            </label>
            <div className={styles.licenseKeyGroup}>
              {item.licenseKeys.map((k, idx) => (
                <div key={k.id} className={styles.licenseKeyRow}>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="라이선스 키 입력"
                    value={k.value}
                    onChange={(e) => handleKeyChange(k.id, e.target.value)}
                  />
                  {/* 삭제 버튼 — 2행부터 표시, 2열 고정 */}
                  {idx > 0 && (
                    <button
                      type="button"
                      className={styles.removeKeyBtn}
                      onClick={() => handleRemoveKey(k.id)}
                      title="라이선스 키 삭제"
                    >
                      <XSquareFill size={20} />
                    </button>
                  )}
                  {/* 플러스 버튼 — 첫 번째 행 + 시리얼 타입일 때, 3열 고정 */}
                  {idx === 0 && item.keyType !== "credential" && item.licenseType !== 'shared' && (
                    <button
                      type="button"
                      className={styles.addKeyBtn}
                      onClick={handleAddKey}
                      title="라이선스 키 추가"
                    >
                      <PlusSquareFill size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 크리덴셜 선택 시 비밀번호 */}
          {item.keyType === "credential" && (
            <div className={styles.inputGroup}>
              <label className={styles.selectLabel}>라이선스 비밀번호</label>
              <div className={styles.licenseKeyRow}>
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

        </div>
      )}
    </div>
  );
};

SwLicenseSection.propTypes = {
  item:         PropTypes.object.isRequired,
  index:        PropTypes.number.isRequired,
  onItemChange: PropTypes.func.isRequired,
};

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
const RequestFormFields = ({
  items,
  onAssetTypeChange,
  onItemChange,
  onRemoveItem,
}) => {
  // 콤보박스 데이터 — 이 컴포넌트에서 직접 호출, select onFocus 시 갱신
  const {
    data: enterpriseAssets = [],
    refetch: refetchEnterprise,
  } = useQuery({
    queryKey: ["enterpriseAssetsForForm"],
    queryFn:  fetchEnterpriseAssetsForForm,
  });

  const {
    data: swAssets = [],
    refetch: refetchSw,
  } = useQuery({
    queryKey: ["swAssetsForForm"],
    queryFn:  fetchSwAssetsForForm,
  });

  const pcCategories = useMemo(() => enterpriseAssets ?? [], [enterpriseAssets]);

  // PC: 선택된 카테고리의 item_type 목록
  const getPcItemTypes = (categoryId) => {
    if (!categoryId) return [];
    const cat = pcCategories.find((c) => String(c.id) === String(categoryId));
    return cat?.item_types ?? [];
  };

  // PC: 선택된 item_type의 제조사 목록
  const getPcManufacturers = (categoryId, itemTypeId) => {
    if (!categoryId || !itemTypeId) return [];
    const itemTypes = getPcItemTypes(categoryId);
    const type = itemTypes.find((t) => String(t.id) === String(itemTypeId));
    return type?.manufacturers ?? [];
  };

  // SW: licenseRequired 기준으로 소프트웨어명 목록 필터링 (item별로 다르므로 함수로)
  const getSwNames = (licenseRequired) => [
    ...new Set(
      (swAssets ?? [])
        .filter((s) => s.license_required === licenseRequired)
        .map((s) => s.name)
        .filter(Boolean)
    ),
  ];

  // SW: 제조사 목록 (중복 제거)
  const swManufacturers = useMemo(() => [
    ...new Set((swAssets ?? []).map((s) => s.manufacturer).filter(Boolean)),
  ], [swAssets]);

  // SW: 버전 목록 (중복 제거)
  const swVersions = useMemo(() => [
    ...new Set((swAssets ?? []).map((s) => s.version).filter(Boolean)),
  ], [swAssets]);

  return (
    <>
      {items.map((item, index) => (
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

              {/* Row 1: 카테고리 + 분류 */}
              <div className={styles.selectRow}>
                <div className={styles.selectGroup}>
                  <label className={styles.selectLabel}>
                    카테고리 <span className={styles.required}>*</span>
                  </label>
                  <select
                    className={styles.select}
                    value={item.categoryId}
                    onFocus={() => refetchEnterprise()}
                    onChange={(e) =>
                      onItemChange(index, {
                        categoryId:       e.target.value,
                        itemTypeId:       "",
                        itemTypeName:     "",
                        manufacturer:     "",
                        manufacturerName: "",
                      })
                    }
                  >
                    <option value="">선택</option>
                    {pcCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {CATEGORY_NAME_MAP[cat.name] ?? cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.selectGroup}>
                  <label className={styles.selectLabel}>
                    분류 <span className={styles.required}>*</span>
                  </label>
                  {item.itemTypeId === DIRECT_INPUT ? (
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="분류 직접 입력"
                      value={item.itemTypeName}
                      autoFocus
                      onChange={(e) => onItemChange(index, "itemTypeName", e.target.value)}
                    />
                  ) : (
                    <select
                      className={styles.select}
                      value={item.itemTypeId}
                      disabled={!item.categoryId}
                      onChange={(e) =>
                        onItemChange(index, {
                          itemTypeId:       e.target.value,
                          itemTypeName:     "",
                          manufacturer:     "",
                          manufacturerName: "",
                        })
                      }
                    >
                      <option value="">선택</option>
                      {getPcItemTypes(item.categoryId).map((type) => (
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
                      disabled={!item.itemTypeId}
                      onChange={(e) =>
                        onItemChange(index, {
                          manufacturer:     e.target.value,
                          manufacturerName: "",
                        })
                      }
                    >
                      <option value="">선택</option>
                      {getPcManufacturers(item.categoryId, item.itemTypeId).map((mfr) => (
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

              {/* Row 1: 구독형 체크박스 + 소프트웨어명 + 제조사 */}
              <div className={styles.selectRow}>

                {/* 구독형 체크박스 */}
                <div className={styles.checkboxGroup}>
                  <label className={styles.selectLabel}>라이선스 유형</label>
                  <div className={styles.checkboxWrapper}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={!item.licenseRequired}
                        onChange={(e) =>
                          onItemChange(index, {
                            licenseRequired:    !e.target.checked,
                            // 전환 시 SW 선택 및 라이선스 관련 필드 초기화
                            swName:             "",
                            swNameDirect:       "",
                            swManufacturer:     "",
                            swManufacturerName: "",
                            version:            "",
                            versionName:        "",
                            licenseKeys:        [{ id: crypto.randomUUID(), value: "" }],
                            licensePassword:    "",
                            quantity:           "",
                          })
                        }
                      />
                      구독형
                    </label>
                  </div>
                </div>

                {/* 소프트웨어명 */}
                <div className={styles.selectGroup}>
                  <label className={styles.selectLabel}>
                    소프트웨어명 <span className={styles.required}>*</span>
                  </label>
                  {item.swName === DIRECT_INPUT ? (
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="소프트웨어명 직접 입력"
                      value={item.swNameDirect}
                      autoFocus
                      onChange={(e) => onItemChange(index, "swNameDirect", e.target.value)}
                    />
                  ) : (
                    <select
                      className={styles.select}
                      value={item.swName}
                      onFocus={() => refetchSw()}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        if (selectedName === DIRECT_INPUT) {
                          onItemChange(index, { swName: DIRECT_INPUT, swNameDirect: "" });
                          return;
                        }
                        // 선택한 SW명으로 제조사 + 버전 자동 채움
                        const matched = (swAssets ?? []).find((s) => s.name === selectedName);
                        onItemChange(index, {
                          swName:             selectedName,
                          swNameDirect:       "",
                          swManufacturer:     matched?.manufacturer ?? "",
                          swManufacturerName: "",
                          version:            matched?.version ?? "",
                          versionName:        "",
                        });
                      }}
                    >
                      <option value="">선택</option>
                      {getSwNames(item.licenseRequired).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      <option value={DIRECT_INPUT}>직접 입력...</option>
                    </select>
                  )}
                </div>

                {/* 제조사 */}
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
                      onFocus={() => refetchSw()}
                      onChange={(e) =>
                        onItemChange(index, {
                          swManufacturer:     e.target.value,
                          swManufacturerName: "",
                        })
                      }
                    >
                      <option value="">선택</option>
                      {swManufacturers.map((mfr) => (
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
                  {item.version === DIRECT_INPUT ? (
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="버전 직접 입력"
                      value={item.versionName}
                      autoFocus
                      onChange={(e) => onItemChange(index, "versionName", e.target.value)}
                    />
                  ) : (
                    <select
                      className={styles.select}
                      value={item.version}
                      onFocus={() => refetchSw()}
                      onChange={(e) =>
                        onItemChange(index, {
                          version:     e.target.value,
                          versionName: "",
                        })
                      }
                    >
                      <option value="">선택</option>
                      {swVersions.map((ver) => (
                        <option key={ver} value={ver}>{ver}</option>
                      ))}
                      <option value={DIRECT_INPUT}>직접 입력...</option>
                    </select>
                  )}
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
                  <label className={styles.selectLabel}>
                    수량 <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    placeholder="1 이상 입력"
                    value={item.quantity}
                    onChange={(e) => onItemChange(index, "quantity", e.target.value)}
                  />
                </div>
              </div>

              {/* Row 3: 관련 링크 + 비고 + 요청 사유 */}
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

              <SwLicenseSection
                item={item}
                index={index}
                onItemChange={onItemChange}
              />

            </div>
          )}

        </div>
      ))}
    </>
  );
};

RequestFormFields.propTypes = {
  items:             PropTypes.array.isRequired,
  onAssetTypeChange: PropTypes.func.isRequired,
  onItemChange:      PropTypes.func.isRequired,
  onRemoveItem:      PropTypes.func,
};

export default RequestFormFields;
