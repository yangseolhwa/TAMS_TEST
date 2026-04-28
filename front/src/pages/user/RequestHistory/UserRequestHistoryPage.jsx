import { useQuery } from "@tanstack/react-query";
import PageHeader from "../../../components/PageHeader/PageHeader";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import styles from "./UserRequestHistoryPage.module.css";
import { fetchAssetRequests } from "../../../services/assetService";

// --- [상수] ---
const COLUMNS = [
  { key: "no",          label: "No" },
  { key: "requestedAt", label: "요청일" },
  { key: "assetType",   label: "자산 유형" },
  { key: "assetName",   label: "자산명" },
  {
    key: "status",
    label: "상태",
    renderCell: (row) => {
      if (!row.status) return <span className={styles.dash}>—</span>;
      return (
        <span className={`${styles.statusBadge} ${styles[`status_${row.status}`]}`}>
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
      );
    },
  },
  { key: "reason", label: "사유" },
];

const STATUS_LABEL = {
  PENDING:  "대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

const UserRequestHistoryPage = () => {
  const { data: rows = [] } = useQuery({
    queryKey: ["assetRequests"],
    queryFn: fetchAssetRequests,
    refetchOnWindowFocus: false,
  });

  return (
    <div className={styles.page}>
      <PageHeader title="내 자산 요청 내역" />

      <section className={styles.section}>
        <Card>
          <DataTable
            columns={COLUMNS}
            rows={rows}
            selectable={false}
            totalCount={rows.length}
          />
        </Card>
      </section>
    </div>
  );
};

export default UserRequestHistoryPage;
