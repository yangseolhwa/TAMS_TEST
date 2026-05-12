import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "../../../components/PageHeader/PageHeader";
import Card from "../../../components/Card/Card";
import DataTable from "../../../components/DataTable/DataTable";
import styles from "./UserRequestHistoryPage.module.css";
import common from '../../AssetPage.common.module.css'
import { fetchAssetRequests } from "../../../services/assetService";
import Banner from "../../../components/Banner/Banner";

// ── 상수 ─────────────────────────────────────────────────────────────────────
const STATUS_LABEL = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }

const STATUS_MAP = {
  PENDING:  { label: '대기', color: 'yellow'  },
  APPROVED: { label: '승인', color: 'green'   },
  REJECTED: { label: '반려', color: 'red'     },
}

const PC_COLUMNS = [
  { key: 'no',              label: 'No'          },
  { key: 'requestedAt',     label: '요청일'      },
  { key: 'itemTypeName',    label: '자산 종류'   },
  { key: 'serialNumber',    label: '시리얼 번호' },
  { key: 'manufacturer',    label: '제조사'      },
  { key: 'status',          label: '상태',       type: 'status' },
  { key: 'rejectionReason', label: '반려 사유'   },
]

const SW_COLUMNS = [
  { key: 'no',              label: 'No'               },
  { key: 'requestedAt',     label: '요청일'           },
  { key: 'assetName',       label: '소프트웨어명'     },
  { key: 'manufacturer',    label: '제조사'           },
  { key: 'licenseKey',      label: '라이선스 키'      },
  { key: 'licensePassword', label: '라이선스 비밀번호' },
  { key: 'status',          label: '상태',            type: 'status' },
  { key: 'rejectionReason', label: '반려 사유'        },
]
// ─────────────────────────────────────────────────────────────────────────────

const UserRequestHistoryPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["assetRequests"],
    queryFn:  fetchAssetRequests,
  });

  const enterpriseRows = useMemo(() => data?.enterpriseRows ?? [], [data]);
  const swRows         = useMemo(() => data?.swRows         ?? [], [data]);

  return (
    <div className={common.page}>
      <PageHeader title="내 자산 요청 내역" />

      {/* PC 섹션 */}
      <section className={styles.section}>
        <div className={styles.summaryWrap}>
          <div className={`${styles.summaryLabel} ${styles.labelPc}`}>PC</div>
          <Card className={styles.summaryCard}>
            <div className={styles.summaryCount}>{enterpriseRows.length}</div>
            <div className={styles.summaryUnit}>요청</div>
          </Card>
        </div>
        <Card className={styles.tableCard}>
          <DataTable
            columns={PC_COLUMNS}
            rows={isLoading ? [] : enterpriseRows}
            statusMap={STATUS_MAP}
            selectable={false}
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
            columns={SW_COLUMNS}
            rows={isLoading ? [] : swRows}
            statusMap={STATUS_MAP}
            selectable={false}
          />
        </Card>
      </section>
    </div>
  );
};

export default UserRequestHistoryPage;
