import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import PageHeader from "../../../components/PageHeader/PageHeader";
import ActionButton from "../../../components/ActionButton/ActionButton";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import RejectReasonModal from "../../../components/RejectReasonModal/RejectReasonModal";
import styles from "./AdminRequestHistoryPage.module.css";
import common from '../../AssetPage.common.module.css'

import {
  fetchAssetRequests,
  approveEnterpriseRequest,
  approveSwRequest,
  rejectEnterpriseRequest,
  rejectSwRequest,
} from "../../../services/assetService";

// ── 상수 ─────────────────────────────────────────────────────────────────────
const PC_COLUMNS = [
  { key: "no",            label: "No"       },
  { key: "requestedAt",   label: "요청일"   },
  { key: "requestType",   label: "요청 유형", type: "status" },
  { key: "userName",      label: "요청자"   },
  { key: "itemTypeName",  label: "자산 종류" },
  { key: "manufacturer",  label: "제조사"   },
  { key: "spec",          label: "규격"     },
  { key: "serialNumber",  label: "시리얼"   },
  { key: "requestReason", label: "요청 사유" },
];

const SW_COLUMNS = [
  { key: "no",              label: "No"            },
  { key: "requestedAt",     label: "요청일"        },
  { key: "requestType",   label: "요청 유형", type: "status" },
  { key: "userName",        label: "요청자"        },
  { key: "assetName",       label: "소프트웨어명"  },
  { key: "manufacturer",    label: "제조사"        },
  { key: "version",         label: "버전"          },
  {
    key: 'license_info',
    label: '라이선스 키 / 비밀번호',
    renderCell: (row) => {
      const key = row.licenseKey
      const pw  = row.licensePassword
      if (!key) return '—'
      if (!pw)  return key
      return `${key} / ${pw}`
    } 
  },
  { key: "requestReason",   label: "요청 사유" },
];

const REQUEST_TYPE_STATUS_MAP = {
  register: { label: '등록', color: 'green'  },
  assign:   { label: '할당', color: 'purple' },
}
// ─────────────────────────────────────────────────────────────────────────────

const AdminRequestHistoryPage = () => {
  const queryClient = useQueryClient();

  const [targetRowId,        setTargetRowId]        = useState(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectModal,    setShowRejectModal]    = useState(false);
  const [rejectReason,       setRejectReason]       = useState("");

  // ── 데이터 조회 ───────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["assetRequests"],
    queryFn: fetchAssetRequests,
  });

  const pcRows = useMemo(() => data?.enterpriseRows ?? [], [data]);
  const swRows = useMemo(() => data?.swRows ?? [], [data]);

  // ── 헬퍼 ─────────────────────────────────────────────────────────────────
  const parseRowId = (rowId) => ({
    type: rowId.startsWith("req-ent-") ? "enterprise" : "sw",
    id:   parseInt(rowId.replace(/^req-(ent|sw)-/, ""), 10),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async (rowId) => {
      const { type, id } = parseRowId(rowId);
      return type === "enterprise"
        ? approveEnterpriseRequest(id)
        : approveSwRequest(id);
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

  const rejectMutation = useMutation({
    mutationFn: async (rowId) => {
      const { type, id } = parseRowId(rowId);
      return type === "enterprise"
        ? rejectEnterpriseRequest(id, rejectReason)
        : rejectSwRequest(id, rejectReason);
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

  // ── 처리 버튼 컬럼 ───────────────────────────────────────────────────────
  const actionsColumn = {
    key: "actions",
    label: "처리",
    renderCell: (row) => (
      <div className={styles.rowActions}>
        <ActionButton
          variant="blue"
          size="xxs"
          label="승인"
          onClick={() => { setTargetRowId(row.id); setShowApproveConfirm(true); }}
        />
        <ActionButton
          variant="red"
          size="xxs"
          label="반려"
          onClick={() => { setTargetRowId(row.id); setRejectReason(""); setShowRejectModal(true); }}
        />
      </div>
    ),
  };

  const pcColumns  = useMemo(() => [...PC_COLUMNS, actionsColumn], []);
  const swColumns  = useMemo(() => [...SW_COLUMNS, actionsColumn], []);

  return (
    <div className={common.page}>
      <PageHeader title="내 자산 요청 내역" />
      {/* PC 섹션 */}
      <section className={styles.section}>
        <div className={styles.summaryWrap}>
          <div className={`${styles.summaryLabel} ${styles.labelPc}`}>PC</div>
          <Card className={styles.summaryCard}>
            <div className={styles.summaryCount}>{pcRows.length}</div>
            <div className={styles.summaryUnit}>요청</div>
          </Card>
        </div>
        <Card className={styles.tableCard}>
          <DataTable
            columns={pcColumns}
            rows={isLoading ? [] : pcRows}
            selectable={false}
            statusMap={REQUEST_TYPE_STATUS_MAP}
          />
        </Card>
      </section>

      {/* SW 섹션 */}
      <section className={styles.section}>
        <div className={styles.summaryWrap}>
          <div className={`${styles.summaryLabel} ${styles.labelSw}`}>SW</div>
          <Card className={styles.summaryCard}>
            <div className={styles.summaryCount}>{swRows.length}</div>
            <div className={styles.summaryUnit}>요청</div>
          </Card>
        </div>
        <Card className={styles.tableCard}>
          <DataTable
            columns={swColumns}
            rows={isLoading ? [] : swRows}
            selectable={false}
            statusMap={REQUEST_TYPE_STATUS_MAP}
          />
        </Card>
      </section>

      {/* 모달 */}
      <ConfirmModal
        isOpen={showApproveConfirm}
        title="요청을 승인할까요?"
        desc="승인된 자산은 즉시 활성화됩니다."
        confirmLabel="승인"
        confirmVariant="primary"
        onConfirm={() => approveMutation.mutate(targetRowId)}
        onCancel={() => setShowApproveConfirm(false)}
      />
      <RejectReasonModal
        isOpen={showRejectModal}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={() => rejectMutation.mutate(targetRowId)}
        onCancel={() => setShowRejectModal(false)}
        isPending={rejectMutation.isPending}
      />
    </div>
  );
};

export default AdminRequestHistoryPage;
