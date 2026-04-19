import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "../../../components/PageHeader/PageHeader";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import styles from "./UserRequestHistoryPage.module.css";
import { fetchAssetRequests } from "../../../services/assetService";

// --- [상수] ---
const STATUS_MAP = {
  APPROVED: { label: "승인", color: "green" },
  REJECTED: { label: "반려", color: "return" },
};

const COLUMNS = [
  { key: "no",          label: "No" },
  { key: "requestedAt", label: "요청일" },
  { key: "assetName",   label: "자산명" },
  { key: "status",      label: "상태", type: "status" },
  { key: "reason",      label: "사유" },
];

const UserRequestHistoryPage = () => {
  const navigate = useNavigate();

  // --- [React Query] ---
  const { data: rows = [] } = useQuery({
    queryKey: ["assetRequests"],
    queryFn: fetchAssetRequests,
    refetchOnWindowFocus: false,
  });

  return (
    <div className={styles.page}>
      <PageHeader
        title="내 자산 요청 내역"
      />

      <section className={styles.section}>
        <Card>
          <>필터링 추가 예정</>
          <DataTable
            columns={COLUMNS}
            rows={rows}
            statusMap={STATUS_MAP}
            selectable={false}
            totalCount={rows.length}
          />
        </Card>
      </section>
    </div>
  );
};

export default UserRequestHistoryPage;
