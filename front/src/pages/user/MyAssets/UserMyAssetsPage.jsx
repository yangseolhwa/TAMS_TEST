import { useState, useMemo } from "react";
import ActionButton from "../../../components/ActionButton/ActionButton";
import PageHeader from "../../../components/PageHeader/PageHeader";
import ConfirmModal from "../../../components/ConfirmModal/ConfirmModal";
import Card from "../../../components/Card/Card";
import styles from "./UserMyAssetsPage.module.css";

// PC 테이블 컬럼
const PC_COLUMNS = [
  { key: "no",               label: "No" },
  { key: "asset_number",     label: "자산 번호",   type: "dash" },
  { key: "department_id",    label: "소관 부서",   type: "dash" },
  { key: "acquisition_date", label: "취득 일자",   type: "dash" },
  { key: "item_type_name",   label: "분류",         type: "dash" },
  { key: "spec",             label: "규격",         type: "dash" },
  { key: "manufacturer",     label: "제조사",       type: "dash" },
  { key: "serial_number",    label: "시리얼 번호", type: "dash" },
  { key: "location",         label: "위치",         type: "dash" },
  { key: "remarks",          label: "비고",         type: "dash" },
];

// SW 테이블 컬럼
const SW_COLUMNS = [
  { key: "no",               label: "No" },
  { key: "asset_name",       label: "소프트웨어명", type: "dash" },
  { key: "version",          label: "버전",          type: "dash" },
  { key: "manufacturer",     label: "제조사",        type: "dash" },
  { key: "license_key",      label: "라이선스 키",  type: "dash" },
  { key: "license_password", label: "라이선스 PW", type: "dash" },
  { key: "related_link",     label: "관련 링크",    type: "link" },
  { key: "remarks",          label: "비고",          type: "dash" },
];

// 목업 데이터
const MOCK_PC_ROWS = [
  { id: "ent-1", no: 1, asset_number: "OFF-NB-001", department_id: 1, acquisition_date: "2024-01-10", item_type_name: "노트북", spec: "MacBook Pro M3 / 32GB", manufacturer: "Apple",    serial_number: "SN-MBP-001", location: "서울 본사 3층", remarks: null },
  { id: "ent-2", no: 2, asset_number: "OFF-MN-001", department_id: 1, acquisition_date: "2024-01-10", item_type_name: "모니터", spec: "27\" 4K UHD",           manufacturer: "LG",       serial_number: "SN-LGM-002", location: "서울 본사 3층", remarks: null },
  { id: "ent-3", no: 3, asset_number: "OFF-KB-001", department_id: 1, acquisition_date: "2024-01-10", item_type_name: "키보드", spec: "MX Keys for Mac",       manufacturer: "Logitech", serial_number: "SN-LOG-003", location: "서울 본사 3층", remarks: null },
];

const MOCK_SW_ROWS = [
  { id: "sw-1-1", no: 1, asset_name: "Figma",             version: "v124.0", manufacturer: "Figma Inc.",  license_key: "FIG-01-0001", license_password: null, related_link: "https://figma.com",  remarks: null },
  { id: "sw-2-1", no: 2, asset_name: "GitHub Enterprise", version: "v3.12",  manufacturer: "GitHub Inc.", license_key: "GIT-02-0001", license_password: null, related_link: "https://github.com", remarks: null },
  { id: "sw-3-1", no: 3, asset_name: "Slack Business+",   version: "v4.35",  manufacturer: "Salesforce",  license_key: "SLA-03-0001", license_password: null, related_link: "https://slack.com",  remarks: null },
];

const UserMyAssetsPage = () => {
  // --- [State] ---
  const [pcRows, setPcRows] = useState(MOCK_PC_ROWS);
  const [swRows, setSwRows] = useState(MOCK_SW_ROWS);

  const [isMoveMode,    setIsMoveMode]    = useState(false);
  const [locationEdits, setLocationEdits] = useState({}); // { [rowId]: string }

  // 모달 상태
  const [showReturnConfirm,    setShowReturnConfirm]    = useState(false);
  const [showMoveConfirm,      setShowMoveConfirm]      = useState(false);
  const [returnTarget,         setReturnTarget]         = useState(null); // { type: "pc"|"sw", id }

  // --- [Handlers: PC 이동] ---
  const handleMoveClick = () => {
    // 현재 위치값으로 편집 초기화
    const initEdits = {};
    pcRows.forEach((row) => { initEdits[row.id] = row.location ?? ""; });
    setLocationEdits(initEdits);
    setIsMoveMode(true);
  };

  const handleMoveSaveClick = () => setShowMoveConfirm(true);

  const handleMoveConfirm = () => {
    // 모든 행의 위치를 편집된 값으로 업데이트
    setPcRows((prev) =>
      prev.map((row) =>
        locationEdits[row.id] !== undefined
          ? { ...row, location: locationEdits[row.id] }
          : row
      )
    );
    cancelMoveMode();
  };

  const cancelMoveMode = () => {
    setIsMoveMode(false);
    setLocationEdits({});
    setShowMoveConfirm(false);
  };

  // --- [Handlers: 반납] ---
  const handleReturnClick = (type, id) => {
    setReturnTarget({ type, id });
    setShowReturnConfirm(true);
  };

  const handleReturnConfirm = () => {
    if (returnTarget.type === "pc") {
      setPcRows((prev) => prev.filter((row) => row.id !== returnTarget.id));
    } else {
      setSwRows((prev) => prev.filter((row) => row.id !== returnTarget.id));
    }
    setShowReturnConfirm(false);
    setReturnTarget(null);
  };

  // --- [PC 컬럼: 이동 모드에서 위치 셀 전체를 input으로 교체] ---
  const pcColumns = useMemo(() => {
    if (!isMoveMode) return PC_COLUMNS;
    return PC_COLUMNS.map((col) => {
      if (col.key !== "location") return col;
      return {
        ...col,
        renderCell: (row) => (
          <input
            className={styles.locationInput}
            value={locationEdits[row.id] ?? ""}
            onChange={(e) =>
              setLocationEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
            }
            placeholder="위치 입력"
          />
        ),
      };
    });
  }, [isMoveMode, locationEdits]);

  // --- [셀 렌더링] ---
  const renderCell = (col, row) => {
    if (col.renderCell) return col.renderCell(row);
    const value = row[col.key];
    if (col.type === "dash") return value ?? "—";
    if (col.type === "link") {
      return value
        ? <a className={styles.link} href={value} target="_blank" rel="noreferrer">{value}</a>
        : "—";
    }
    return value ?? "—";
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="내 자산 현황"
        desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요."
      />

      {/* SW 섹션 */}
      <section className={styles.section}>
        <div className={styles.summaryWrap}>
          <div className={`${styles.summaryLabel} ${styles.labelSw}`}>SW</div>
          <Card className={styles.summaryCard}>
            <div className={styles.summaryCount}>{swRows.length}</div>
            <div className={styles.summaryUnit}>보유</div>
          </Card>
        </div>

        <Card className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {SW_COLUMNS.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th className={styles.colAction}>반납</th>
                </tr>
              </thead>
              <tbody>
                {swRows.length === 0 ? (
                  <tr><td colSpan={SW_COLUMNS.length + 1} className={styles.empty}>보유한 SW 자산이 없습니다.</td></tr>
                ) : swRows.map((row) => (
                  <tr key={row.id}>
                    {SW_COLUMNS.map((col) => (
                      <td key={col.key}>{renderCell(col, row)}</td>
                    ))}
                    <td className={styles.colAction}>
                      <ActionButton variant="red" size="xxs" label="반납" onClick={() => handleReturnClick("sw", row.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* PC 섹션 */}
      <section className={styles.section}>
        <div className={styles.summaryWrap}>
          <div className={`${styles.summaryLabel} ${styles.labelPc}`}>PC</div>
          <Card className={styles.summaryCard}>
            <div className={styles.summaryCount}>{pcRows.length}</div>
            <div className={styles.summaryUnit}>보유</div>
          </Card>
        </div>

        <Card className={styles.tableCard}>
          <div className={styles.tableActions}>
            {isMoveMode ? (
              <>
                <ActionButton variant="white"   size="sm"  label="취소" onClick={cancelMoveMode} />
                <ActionButton variant="black"   size="sm"  label="저장" onClick={handleMoveSaveClick} />
              </>
            ) : (
              <ActionButton variant="outline" size="sm"  label="수정" onClick={handleMoveClick} />
            )}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {pcColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th className={styles.colAction}>반납</th>
                </tr>
              </thead>
              <tbody>
                {pcRows.length === 0 ? (
                  <tr><td colSpan={PC_COLUMNS.length + 1} className={styles.empty}>보유한 PC 자산이 없습니다.</td></tr>
                ) : pcRows.map((row) => (
                  <tr key={row.id}>
                    {pcColumns.map((col) => (
                      <td key={col.key}>{renderCell(col, row)}</td>
                    ))}
                    <td className={styles.colAction}>
                      <ActionButton variant="red" size="xxs" label="반납" onClick={() => handleReturnClick("pc", row.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* 모달 모음 */}
      <ConfirmModal
        isOpen={showReturnConfirm}
        title="자산을 반납할까요?"
        desc="반납된 자산은 목록에서 제외됩니다."
        confirmLabel="반납"
        confirmVariant="danger"
        onConfirm={handleReturnConfirm}
        onCancel={() => { setShowReturnConfirm(false); setReturnTarget(null); }}
      />
      <ConfirmModal
        isOpen={showMoveConfirm}
        title="위치를 변경할까요?"
        desc="입력한 위치로 자산이 이동됩니다."
        confirmLabel="저장"
        confirmVariant="primary"
        onConfirm={handleMoveConfirm}
        onCancel={() => setShowMoveConfirm(false)}
      />
    </div>
  );
};

export default UserMyAssetsPage;
