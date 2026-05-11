import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircleFill } from "react-bootstrap-icons";
import toast from "react-hot-toast";
import ActionButton from "../../../components/ActionButton/ActionButton";
import Card from "../../../components/Card/Card";
import Banner from "../../../components/Banner/Banner";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, {
  createInitialItem,
} from "../../../components/RequestFormFields/RequestFormFields";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import styles from "./AdminRequestPage.module.css";
import common from '../../AssetPage.common.module.css'
import {
  requestEnterpriseAsset,
  requestSwAsset,
} from "../../../services/assetService";

// ─── 상수 ────────────────────────────────────────────────────────────────────
const MAX_ITEMS    = 5;
const DIRECT_INPUT = "__direct__";

// ─────────────────────────────────────────────────────────────────────────────

const AdminRequestPage = () => {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [items,             setItems]             = useState([createInitialItem()]);
  const [showResetConfirm,  setShowResetConfirm]  = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // ── 폼 핸들러 ──────────────────────────────────────────────────────────────

  // 자산 유형(PC/SW) 변경 시 해당 항목 초기화
  const handleAssetTypeChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...createInitialItem(), id: item.id, assetType: value }
          : item
      )
    );
  };

  // 단일 필드 또는 객체로 여러 필드 동시 변경
  const handleItemChange = (index, fieldOrObject, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (typeof fieldOrObject === "object") return { ...item, ...fieldOrObject };
        return { ...item, [fieldOrObject]: value };
      })
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

  // ── 등록 Mutation ──────────────────────────────────────────────────────────
  // admin은 즉시 등록
  const submitMutation = useMutation({
    mutationFn: async () => {
      const pcItems = items.filter((item) => item.assetType === "pc");
      const swItems = items.filter((item) => item.assetType === "sw");

      const tasks = [
        // PC — 신규 등록
        ...(pcItems.length > 0
          ? [{
              items: pcItems,
              promise: requestEnterpriseAsset({
                assets: pcItems.map((item) => ({
                  category_id: Number(item.categoryId),
                  ...(item.itemTypeId && item.itemTypeId !== DIRECT_INPUT
                    ? { item_type_id:   Number(item.itemTypeId) }
                    : { item_type_name: item.itemTypeName.trim() }
                  ),
                  manufacturer: item.manufacturer === DIRECT_INPUT
                    ? item.manufacturerName.trim()
                    : item.manufacturer,
                  acquisition_date: item.acquisitionDate,
                  ...(item.spec.trim()          && { spec:           item.spec.trim() }),
                  ...(item.serialNumber.trim()  && { serial_number:  item.serialNumber.trim() }),
                  ...(item.requestReason.trim() && { request_reason: item.requestReason.trim() }),
                  ...(item.remarks.trim()       && { remarks:        item.remarks.trim() }),
                })),
              }),
            }]
          : []),

        // SW — 신규 등록 (아이템별 개별 요청)
        ...swItems.map((item) => {
          const swName = item.swName === DIRECT_INPUT
            ? item.swNameDirect.trim()
            : item.swName.trim();
          const manufacturer = item.swManufacturer === DIRECT_INPUT
            ? item.swManufacturerName.trim()
            : item.swManufacturer;
          const version = item.version === DIRECT_INPUT
            ? item.versionName.trim()
            : item.version;

          const body = {
            name:             swName,
            manufacturer,
            license_required: item.licenseRequired,
            ...(version                   && { version }),
            ...(item.acquisitionDateSw    && { acquisition_date: item.acquisitionDateSw }),
            ...(item.swRemarks.trim()     && { remarks:          item.swRemarks.trim() }),
            ...(item.relatedLink.trim()   && { related_link:     item.relatedLink.trim() }),
            ...(item.requestReason.trim() && { request_reason:   item.requestReason.trim() }),
          };

          if (!item.licenseRequired) {
            // 구독형: 수량 전송
            body.quantity = Number(item.quantity);
          } else {
            // 라이선스형: 라이선스 키 배열 전송 (빈 값 제외)
            body.licenses = item.licenseKeys
              .filter((k) => k.value.trim())
              .map((k) => ({
                license_key:  k.value.trim(),
                key_type:     item.keyType,
                license_type: item.licenseType,
                ...(item.licensePassword.trim() && { license_password: item.licensePassword.trim() }),
              }));
          }

          return {
            items: [item],
            promise: requestSwAsset(body),
          };
        }),
      ];

      const results = await Promise.allSettled(tasks.map((t) => t.promise));

      // 실패한 task의 items만 반환하여 폼에 남김
      const failedItems = results.flatMap((result, i) =>
        result.status === "rejected" ? tasks[i].items : []
      );

      return failedItems;
    },
    onSuccess: (failedItems) => {
      queryClient.invalidateQueries({ queryKey: ["personalAssets"] });
      queryClient.invalidateQueries({ queryKey: ["enterpriseAssetsForForm"] });
      queryClient.invalidateQueries({ queryKey: ["swAssetsForForm"] });
      setShowSubmitConfirm(false);

      if (failedItems.length === 0) {
        toast.success("자산이 등록되었습니다.");
        setItems([createInitialItem()]);
      } else if (failedItems.length === items.length) {
        toast.error("자산 등록에 실패했습니다. 다시 시도해주세요.");
      } else {
        toast.error("일부 항목 등록에 실패했습니다. 실패한 항목을 확인 후 다시 등록해주세요.");
        setItems(failedItems);
      }
    },
    onError: () => {
      toast.error("자산 등록 중 오류가 발생했습니다. 다시 시도해주세요.");
      setShowSubmitConfirm(false);
    },
  });

  // ── 유효성 검사 ────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    for (const item of items) {
      if (!item.assetType) {
        toast.error("자산 유형을 선택해주세요.");
        return;
      }

      if (item.assetType === "pc") {
        if (!item.categoryId) {
          toast.error("PC: 카테고리를 선택해주세요.");
          return;
        }
        const hasItemType =
          (item.itemTypeId && item.itemTypeId !== DIRECT_INPUT) ||
          item.itemTypeName.trim();
        if (!hasItemType) {
          toast.error("PC: 자산 유형을 선택하거나 직접 입력해주세요.");
          return;
        }
        const manufacturer = item.manufacturer === DIRECT_INPUT
          ? item.manufacturerName.trim()
          : item.manufacturer;
        if (!manufacturer) {
          toast.error("PC: 제조사를 선택하거나 직접 입력해주세요.");
          return;
        }
        if (!item.acquisitionDate) {
          toast.error("PC: 취득일은 필수 항목입니다.");
          return;
        }
      }

      if (item.assetType === "sw") {
        const swName = item.swName === DIRECT_INPUT
          ? item.swNameDirect?.trim()
          : item.swName.trim();
        if (!swName) {
          toast.error("SW: 소프트웨어명을 입력해주세요.");
          return;
        }
        const manufacturer = item.swManufacturer === DIRECT_INPUT
          ? item.swManufacturerName.trim()
          : item.swManufacturer;
        if (!manufacturer) {
          toast.error("SW: 제조사를 선택하거나 직접 입력해주세요.");
          return;
        }
        if (!item.licenseRequired && Number(item.quantity) < 1) {
          toast.error("SW: 구독형은 수량을 입력해주세요.");
          return;
        }
        if (item.licenseRequired) {
          if (!item.keyType) {
            toast.error("SW: 키 유형을 선택해주세요.");
            return;
          }
          const hasValidKey = item.licenseKeys.some((k) => k.value.trim());
          if (!hasValidKey) {
            toast.error("SW: 라이선스 키를 입력해주세요.");
            return;
          }
        }
      }
    }

    setShowSubmitConfirm(true);
  };

  // ── 렌더링 ─────────────────────────────────────────────────────────────────
  return (
    <div className={common.page}>
      <PageHeader title="내 자산 등록" />

      <section className={styles.section}>
        <Card>
          <Banner
            text={
              <>
                소프트웨어 및 PC 장비를 최대 <strong>5개</strong>까지 동시에
                등록할 수 있습니다. 등록 후 <strong>내 자산 관리</strong>에서
                확인하세요.
              </>
            }
          />
          <fieldset
            disabled={submitMutation.isPending}
            style={{ border: "none", padding: 0, margin: 0 }}
          >
            <RequestFormFields
              items={items}
              onAssetTypeChange={handleAssetTypeChange}
              onItemChange={handleItemChange}
              onRemoveItem={handleRemoveItem}
            />
          </fieldset>

          <div className={styles.formActions}>
            {items.length < MAX_ITEMS && (
              <button
                className={styles.addItemBtn}
                onClick={handleAddItem}
                disabled={submitMutation.isPending}
              >
                <PlusCircleFill size={15} />
                항목 추가 ({items.length} / {MAX_ITEMS})
              </button>
            )}
            <div className={styles.actionBtns}>
              <ActionButton
                variant="white"
                size="md"
                label="초기화"
                onClick={() => setShowResetConfirm(true)}
                disabled={submitMutation.isPending}
              />
              <ActionButton
                variant="blue"
                size="md"
                label="등록"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
              />
            </div>
          </div>
        </Card>
      </section>

      {/* 모달 */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="입력 내용을 초기화할까요?"
        desc="작성한 모든 항목이 삭제되고 초기 상태로 돌아갑니다."
        confirmLabel="초기화"
        confirmVariant="danger"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
      <ConfirmModal
        isOpen={showSubmitConfirm}
        title={`자산 ${items.length}개를 등록할까요?`}
        desc="자산이 바로 등록됩니다."
        confirmLabel="등록"
        confirmVariant="primary"
        onConfirm={() => submitMutation.mutate()}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </div>
  );
};

export default AdminRequestPage;
