import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import styles from "./UserRequestPage.module.css";
import {
  fetchEnterpriseAssetsForForm,
  fetchSwAssetsForForm,
  requestEnterpriseAsset,
  requestSwAsset,
} from "../../../services/assetService";

// ─── 상수 ────────────────────────────────────────────────────────────────────
const MAX_ITEMS    = 5;
const DIRECT_INPUT = "__direct__";

// ─────────────────────────────────────────────────────────────────────────────

const UserRequestPage = () => {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [items,             setItems]             = useState([createInitialItem()]);
  const [showResetConfirm,  setShowResetConfirm]  = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // ── 데이터 조회 ────────────────────────────────────────────────────────────
  const { data: enterpriseAssetsForForm = [] } = useQuery({
    queryKey: ["enterpriseAssetsForForm"],
    queryFn:  fetchEnterpriseAssetsForForm,
    refetchOnWindowFocus: false,
  });

  const { data: swAssetsForForm = [] } = useQuery({
    queryKey: ["swAssetsForForm"],
    queryFn:  fetchSwAssetsForForm,
    refetchOnWindowFocus: false,
  });

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

  // ── 등록 요청 Mutation ─────────────────────────────────────────────────────
  // user는 pending 요청 생성 (최대 5개)
  // PC: 항상 신규 등록 요청
  // SW: swId가 실제 id면 기존 SW에 라이선스 추가 요청, 아니면 신규 SW 등록 요청
  const submitMutation = useMutation({
    mutationFn: async () => {
      const pcItems = items.filter((i) => i.assetType === "pc");
      const swItems = items.filter((i) => i.assetType === "sw");

      const tasks = [
        // PC — 신규 등록 요청 (여러 개 한 번에)
        ...(pcItems.length > 0
          ? [{
              items: pcItems,
              promise: requestEnterpriseAsset({
                assets: pcItems.map((i) => ({
                  category_id: Number(i.categoryId),
                  ...(i.itemTypeId && i.itemTypeId !== DIRECT_INPUT
                    ? { item_type_id:   Number(i.itemTypeId) }
                    : { item_type_name: i.itemTypeName.trim() }
                  ),
                  manufacturer: i.manufacturer === DIRECT_INPUT
                    ? i.manufacturerName.trim()
                    : i.manufacturer,
                  acquisition_date: i.acquisitionDate,
                  ...(i.spec.trim()          && { spec:           i.spec.trim() }),
                  ...(i.serialNumber.trim()  && { serial_number:  i.serialNumber.trim() }),
                  ...(i.requestReason.trim() && { request_reason: i.requestReason.trim() }),
                })),
              }),
            }]
          : []),

        // SW — swId 유무로 기존/신규 분기, 아이템별 개별 요청
        ...swItems.map((i) => {
          const isExistingSw = i.swId && i.swId !== DIRECT_INPUT;
          const manufacturer = i.swManufacturer === DIRECT_INPUT
            ? i.swManufacturerName.trim()
            : i.swManufacturer;

          // 라이선스 공통 데이터
          const licenseData = {
            license_key:  i.licenseKey.trim(),
            key_type:     i.keyType,
            license_type: i.licenseType,
            ...(i.licensePassword.trim() && { license_password: i.licensePassword.trim() }),
            ...(i.relatedLink.trim()     && { related_link:     i.relatedLink.trim() }),
            ...(i.requestReason.trim()   && { request_reason:   i.requestReason.trim() }),
          };

          return {
            items: [i],
            promise: requestSwAsset(
              isExistingSw
                ? {
                    is_existing:  true,
                    asset_sw_id:  Number(i.swId),
                    licenses: [licenseData],
                  }
                : {
                    name:         i.swName.trim(),
                    manufacturer,
                    ...(i.version.trim()    && { version:          i.version.trim() }),
                    ...(i.acquisitionDateSw && { acquisition_date: i.acquisitionDateSw }),
                    ...(i.quantity !== ""   && { quantity:         Number(i.quantity) }),
                    ...(i.swRemarks.trim()  && { remarks:          i.swRemarks.trim() }),
                    licenses: [licenseData],
                  }
            ),
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
      queryClient.invalidateQueries({ queryKey: ["assetRequests"] });
      setShowSubmitConfirm(false);

      if (failedItems.length === 0) {
        toast.success("자산 등록 요청이 완료되었습니다.");
        setItems([createInitialItem()]);
      } else if (failedItems.length === items.length) {
        toast.error("등록 요청에 실패했습니다. 다시 시도해주세요.");
      } else {
        toast.error("일부 항목 요청에 실패했습니다. 실패한 항목을 확인 후 다시 요청해주세요.");
        setItems(failedItems);
      }
    },
    onError: () => {
      toast.error("등록 요청 중 오류가 발생했습니다. 다시 시도해주세요.");
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
        const isExistingSw = item.swId && item.swId !== DIRECT_INPUT;

        if (!isExistingSw && !item.swName.trim()) {
          toast.error("SW: 소프트웨어명은 필수 항목입니다.");
          return;
        }
        const manufacturer = item.swManufacturer === DIRECT_INPUT
          ? item.swManufacturerName.trim()
          : item.swManufacturer;
        if (!manufacturer) {
          toast.error("SW: 제조사를 선택하거나 직접 입력해주세요.");
          return;
        }
        if (!item.licenseKey.trim()) {
          toast.error("SW: 라이선스 키는 필수 항목입니다.");
          return;
        }
        if (!item.keyType) {
          toast.error("SW: 키 유형을 선택해주세요.");
          return;
        }
      }
    }

    setShowSubmitConfirm(true);
  };

  // ── 렌더링 ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <PageHeader title="내 자산 등록 요청" />

      <section className={styles.section}>
        <Card>
          <Banner
            text={
              <>
                소프트웨어 및 PC 장비를 최대 <strong>5개</strong>까지 동시에
                요청할 수 있습니다. 처리 상태는 <strong>요청 내역</strong>에서
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
              enterpriseAssets={enterpriseAssetsForForm}
              swAssets={swAssetsForForm}
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
                label="요청"
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
        title={`자산 ${items.length}개를 등록 요청할까요?`}
        desc="관리자 승인 후 자산이 등록됩니다."
        confirmLabel="요청"
        confirmVariant="primary"
        onConfirm={() => submitMutation.mutate()}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </div>
  );
};

export default UserRequestPage;
