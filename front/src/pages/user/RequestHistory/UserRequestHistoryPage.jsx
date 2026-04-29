import { useQuery } from "@tanstack/react-query";
import PageHeader from "../../../components/PageHeader/PageHeader";
import Card from "../../../components/Card/Card";
import styles from "./UserRequestHistoryPage.module.css";
import { fetchAssetRequests } from "../../../services/assetService";

// --- [상수] ---

const STATUS_LABEL = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }

const PC_COLUMNS = [
  { key: 'no',              label: 'No'         },
  { key: 'requestedAt',     label: '요청일'     },
  { key: 'itemTypeName',    label: '자산 종류'  },
  { key: 'serialNumber',    label: '시리얼 번호' },
  { key: 'manufacturer',    label: '제조사'     },
  { key: 'status',          label: '상태'       },
  { key: 'rejectionReason', label: '반려 사유'  },
]

const SW_COLUMNS = [
  { key: 'no',              label: 'No'              },
  { key: 'requestedAt',     label: '요청일'          },
  { key: 'assetName',       label: '소프트웨어명'    },
  { key: 'manufacturer',    label: '제조사'          },
  { key: 'licenseKey',      label: '라이선스 키'     },
  { key: 'licensePassword', label: '라이선스 비밀번호' },
  { key: 'status',          label: '상태'            },
  { key: 'rejectionReason', label: '반려 사유'       },
]

// --- [셀 렌더링] ---
const renderCell = (col, row) => {
  const value = row[col.key]

  if (col.key === 'status') {
    if (!value) return '—'
    return (
      <span className={`${styles.statusBadge} ${styles[`status_${value}`]}`}>
        {STATUS_LABEL[value] ?? value}
      </span>
    )
  }

  return value ?? '—'
}

const UserRequestHistoryPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["assetRequests"],
    queryFn:  fetchAssetRequests,
    refetchOnWindowFocus: false,
  });

  const enterpriseRows = data?.enterpriseRows ?? []
  const swRows         = data?.swRows         ?? []

  return (
    <div className={styles.page}>
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
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {PC_COLUMNS.map((col) => <th key={col.key}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={PC_COLUMNS.length} className={styles.empty}>불러오는 중...</td></tr>
                ) : enterpriseRows.length === 0 ? (
                  <tr><td colSpan={PC_COLUMNS.length} className={styles.empty}>요청 내역이 없습니다.</td></tr>
                ) : enterpriseRows.map((row) => (
                  <tr key={row.id}>
                    {PC_COLUMNS.map((col) => <td key={col.key}>{renderCell(col, row)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {SW_COLUMNS.map((col) => <th key={col.key}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={SW_COLUMNS.length} className={styles.empty}>불러오는 중...</td></tr>
                ) : swRows.length === 0 ? (
                  <tr><td colSpan={SW_COLUMNS.length} className={styles.empty}>요청 내역이 없습니다.</td></tr>
                ) : swRows.map((row) => (
                  <tr key={row.id}>
                    {SW_COLUMNS.map((col) => <td key={col.key}>{renderCell(col, row)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default UserRequestHistoryPage;
