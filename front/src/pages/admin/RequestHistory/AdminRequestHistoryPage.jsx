import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import PageHeader from "../../../components/PageHeader/PageHeader";
import HeaderButton from "../../../components/HeaderButton/HeaderButton";
import BackButton from "../../../components/BackButton/BackButton";
import Banner from "../../../components/Banner/Banner";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import RejectReasonModal from "../../../components/RejectReasonModal/RejectReasonModal";
import styles from "./AdminRequestHistoryPage.module.css";
import {
  fetchAssetRequests,
  approveEnterpriseRequest,
  approveSwRequest,
  rejectEnterpriseRequest,
  rejectSwRequest,
} from "../../../services/assetService";

/**
 * [공통 설정]
 */
const BASE_REQUEST_COLUMNS = [
  { key: "no",          label: "No" },
  { key: "requester",   label: "요청자",    type: "dash" },
  { key: "assetType",   label: "자산 유형", type: "assetType" },
  { key: "assetName",   label: "자산명" },
  { key: "spec",        label: "규격",      type: "dash" },
  { key: "requestType", label: "요청 구분" },
  { key: "requestedAt", label: "요청일" },
  { key: "status",      label: "상태",      type: "status" },
];

const REQUEST_STATUS_MAP = {
  PENDING:  { label: "대기", color: "yellow" },
  APPROVED: { label: "승인", color: "green"  },
  REJECTED: { label: "반려", color: "red"    },
};

const AdminRequestHistoryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- [State] ---
  const [targetRowId,        setTargetRowId]        = useState(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectModal,    setShowRejectModal]    = useState(false);
  const [rejectReason,       setRejectReason]       = useState("");

  // --- [React Query] ---
  const { data: requestRows = [], isLoading } = useQuery({
    queryKey: ["assetRequests"],
    queryFn: fetchAssetRequests,
    refetchOnWindowFocus: false,
  });

  // --- [Mutations] ---

  // 승인 Mutation — 단일 행 처리
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (targetRowId.startsWith("req-ent-")) {
        const id = parseInt(targetRowId.replace("req-ent-", ""), 10);
        return approveEnterpriseRequest(id);
      } else {
        const id = parseInt(targetRowId.replace("req-sw-", ""), 10);
        return approveSwRequest(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetRequests"] });
      queryClient.invalidateQueries({ queryKey: ["personalAssets"] });
      toast.success("요청이 승인되었습니다.");
      setShowApproveConfirm(false);
      setTargetRowId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setShowApproveConfirm(false);
    },
  });

  // 반려 Mutation — 단일 행 처리
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (targetRowId.startsWith("req-ent-")) {
        const id = parseInt(targetRowId.replace("req-ent-", ""), 10);
        return rejectEnterpriseRequest(id, rejectReason);
      } else {
        const id = parseInt(targetRowId.replace("req-sw-", ""), 10);
        return rejectSwRequest(id, rejectReason);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assetRequests"] });
      toast.success("요청이 반려되었습니다.");
      setShowRejectModal(false);
      setRejectReason("");
      setTargetRowId(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // --- [컬럼 정의: 행마다 승인/반려 버튼 추가] ---
  // state setter는 안정적이므로 deps 빈 배열로 처리
  const columns = useMemo(() => [
    ...BASE_REQUEST_COLUMNS,
    {
      key: "actions",
      label: "처리",
      renderCell: (row) => (
        <div className={styles.rowActions}>
          <button
            className={styles.approveBtn}
            onClick={() => { setTargetRowId(row.id); setShowApproveConfirm(true); }}
          >
            승인
          </button>
          <button
            className={styles.rejectBtn}
            onClick={() => { setTargetRowId(row.id); setRejectReason(""); setShowRejectModal(true); }}
          >
            반려
          </button>
        </div>
      ),
    },
  ], []);

  return (
    <div className={styles.page}>
      <PageHeader
        title="자산 등록 요청"
        desc={<BackButton label="내 자산 관리" to="/admin/my-assets" />}
        actions={
          <>
            <HeaderButton
              label="등록 요청"
              onClick={() => navigate("/admin/my-assets/request")}
            />
            <HeaderButton
              active
              label="요청 내역"
              onClick={() => {}}
            />
          </>
        }
      />

      <section className={styles.section}>
        <Card>
          <Banner
            text={<>사용자의 <strong>등록 요청</strong>을 승인하거나 반려할 수 있습니다.</>}
          />
          <DataTable
            columns={columns}
            rows={requestRows}
            statusMap={REQUEST_STATUS_MAP}
            selectable={false}
            totalCount={requestRows.length}
            isLoading={isLoading}
          />
        </Card>
      </section>

      {/* 모달 모음 */}
      <ConfirmModal
        isOpen={showApproveConfirm}
        title="요청을 승인할까요?"
        desc="승인된 자산은 즉시 활성화됩니다."
        confirmLabel="승인"
        confirmVariant="primary"
        onConfirm={() => approveMutation.mutate()}
        onCancel={() => setShowApproveConfirm(false)}
      />
      <RejectReasonModal
        isOpen={showRejectModal}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={() => rejectMutation.mutate()}
        onCancel={() => setShowRejectModal(false)}
        isPending={rejectMutation.isPending}
      />
    </div>
  );
};

export default AdminRequestHistoryPage;
