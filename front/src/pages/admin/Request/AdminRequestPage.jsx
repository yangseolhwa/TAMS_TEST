import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PlusCircleFill } from "react-bootstrap-icons";
import ActionButton from "../../../components/ActionButton/ActionButton";
import toast from "react-hot-toast";
import Card from "../../../components/Card/Card";
import Banner from "../../../components/Banner/Banner";
import PageHeader from "../../../components/PageHeader/PageHeader";
import RequestFormFields, {
  createInitialItem,
} from "../../../components/RequestFormFields/RequestFormFields";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import styles from "./AdminRequestPage.module.css";
import {
  fetchEnterpriseAssetsForForm,
  fetchSwAssetsForForm,
  requestEnterpriseAsset,
  requestSwAsset,
} from "../../../services/assetService";

/**
 * [공통 설정]
 */
const MAX_ITEMS = 5;

const AdminRequestPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- [State] ---
  const [items, setItems] = useState([createInitialItem()]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // --- [React Query] ---

  // 등록 폼용 Enterprise 자산 목록
  const { data: enterpriseAssetsForForm = [] } = useQuery({
    queryKey: ["enterpriseAssetsForForm"],
    queryFn: fetchEnterpriseAssetsForForm,
    refetchOnWindowFocus: false,
  });

  // 등록 폼용 SW 자산 목록
  const { data: swAssetsForForm = [] } = useQuery({
    queryKey: ["swAssetsForForm"],
    queryFn: fetchSwAssetsForForm,
    refetchOnWindowFocus: false,
  });

  // --- [Handlers: 등록 폼] ---
  const handleAssetTypeChange = (index, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...createInitialItem(), id: item.id, assetType: value }
          : item,
      ),
    );
  };

  // fieldOrObject: 단일 필드명(string) 또는 { field: value, ... } 객체 (카스케이딩 초기화 등에 활용)
  const handleItemChange = (index, fieldOrObject, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (typeof fieldOrObject === "object")
          return { ...item, ...fieldOrObject };
        return { ...item, [fieldOrObject]: value };
      }),
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

  // 등록 Mutation — PC/SW, 기존/신규 분리 후 Promise.allSettled로 동시 호출
  // 각 task에 해당 items를 함께 묶어, 실패한 task의 items만 폼에 남겨 재시도 가능하게 처리
  const submitMutation = useMutation({
    mutationFn: async () => {
      const pcNew = items.filter(
        (i) => i.assetType === "pc" && i.requestType === "new",
      );
      const pcExisting = items.filter(
        (i) => i.assetType === "pc" && i.requestType === "existing",
      );
      const swNew = items.filter(
        (i) => i.assetType === "sw" && i.requestType === "new",
      );
      const swExisting = items.filter(
        (i) => i.assetType === "sw" && i.requestType === "existing",
      );

      // { promise, items } 형태로 묶어서 관리
      const tasks = [
        ...(pcNew.length > 0
          ? [{
              items: pcNew,
              promise: requestEnterpriseAsset({
                is_existing: false,
                assets: pcNew.map((i) => ({
                  asset_number: i.assetNumber.trim(),
                  model_name: i.modelName.trim(),
                  category_id: Number(i.categoryId),
                  item_type_id: Number(i.itemTypeId),
                  manufacturer: i.manufacturer.trim(),
                  acquisition_date: i.acquisitionDate,
                  ...(i.spec.trim() && { spec: i.spec.trim() }),
                  ...(i.serialNumber.trim() && {
                    serial_number: i.serialNumber.trim(),
                  }),
                  ...(i.requiredQuantity && {
                    required_quantity: Number(i.requiredQuantity),
                  }),
                  ...(i.requestReason.trim() && {
                    request_reason: i.requestReason.trim(),
                  }),
                })),
              }),
            }]
          : []),

        ...(pcExisting.length > 0
          ? [{
              items: pcExisting,
              promise: requestEnterpriseAsset({
                is_existing: true,
                assets: pcExisting.map((i) => ({
                  asset_id: Number(i.selectedAssetId),
                  acquisition_date: i.acquisitionDate,
                  ...(i.spec.trim() && { spec: i.spec.trim() }),
                  ...(i.serialNumber.trim() && {
                    serial_number: i.serialNumber.trim(),
                  }),
                  ...(i.requiredQuantity && {
                    required_quantity: Number(i.requiredQuantity),
                  }),
                  ...(i.requestReason.trim() && {
                    request_reason: i.requestReason.trim(),
                  }),
                })),
              }),
            }]
          : []),

        ...(swNew.length > 0
          ? [{
              items: swNew,
              promise: requestSwAsset({
                is_existing: false,
                licenses: swNew.map((i) => ({
                  name: i.swName.trim(),
                  software_type: i.softwareType,
                  manufacturer: i.swManufacturer.trim(),
                  license_key: i.licenseKey.trim(),
                  key_type: i.keyType,
                  ...(i.isSubscription !== "" && {
                    is_subscription: i.isSubscription === "true",
                  }),
                  ...(i.requestReason.trim() && {
                    request_reason: i.requestReason.trim(),
                  }),
                })),
              }),
            }]
          : []),

        ...(swExisting.length > 0
          ? [{
              items: swExisting,
              promise: requestSwAsset({
                is_existing: true,
                licenses: swExisting.map((i) => ({
                  asset_sw_id: Number(i.selectedSwId),
                  license_key: i.licenseKey.trim(),
                  key_type: i.keyType,
                  ...(i.requestReason.trim() && {
                    request_reason: i.requestReason.trim(),
                  }),
                })),
              }),
            }]
          : []),
      ];

      const results = await Promise.allSettled(tasks.map((t) => t.promise));

      // 실패한 task에 해당하는 items만 추출
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
        // 전체 성공
        toast.success("자산이 등록되었습니다.");
        setItems([createInitialItem()]);
      } else if (failedItems.length === items.length) {
        // 전체 실패
        toast.error("자산 등록에 실패했습니다. 다시 시도해주세요.");
      } else {
        // 일부 성공, 일부 실패 — 실패한 항목만 폼에 남김
        toast.error("일부 항목 등록에 실패했습니다. 실패한 항목을 확인 후 다시 등록해주세요.");
        setItems(failedItems);
      }
    },
    onError: () => {
      toast.error("자산 등록 중 오류가 발생했습니다. 다시 시도해주세요.");
      setShowSubmitConfirm(false);
    },
  });

  const handleSubmit = () => {
    // 각 항목 유효성 검사
    for (const item of items) {
      if (!item.assetType) {
        toast.error("자산 유형을 선택해주세요.");
        return;
      }
      if (item.assetType === "pc" && item.requestType === "existing") {
        if (!item.selectedAssetId || !item.acquisitionDate) {
          toast.error("PC 기존 자산: 자산 선택과 취득일은 필수 항목입니다.");
          return;
        }
      }
      if (item.assetType === "pc" && item.requestType === "new") {
        if (
          !item.assetNumber ||
          !item.categoryId ||
          !item.itemTypeId ||
          !item.manufacturer ||
          !item.modelName ||
          !item.acquisitionDate
        ) {
          toast.error("PC 신규 자산: 필수 항목을 모두 입력해주세요.");
          return;
        }
      }
      if (item.assetType === "sw" && item.requestType === "existing") {
        if (!item.selectedSwId || !item.licenseKey || !item.keyType) {
          toast.error(
            "SW 기존 자산: 소프트웨어 선택, 라이선스키, 키 유형은 필수 항목입니다.",
          );
          return;
        }
      }
      if (item.assetType === "sw" && item.requestType === "new") {
        if (
          !item.swName ||
          !item.softwareType ||
          !item.swManufacturer ||
          !item.licenseKey ||
          !item.keyType
        ) {
          toast.error("SW 신규 자산: 필수 항목을 모두 입력해주세요.");
          return;
        }
      }
    }
    setShowSubmitConfirm(true);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="내 자산 등록"
      />

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
          <fieldset disabled={submitMutation.isPending} style={{ border: "none", padding: 0, margin: 0 }}>
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
                <PlusCircleFill size={15} /> 항목 추가 ({items.length} /{" "}
                {MAX_ITEMS})
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

      {/* 모달 모음 */}
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
