import { useState, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "react-bootstrap-icons";
import HeaderButton from "../../../components/HeaderButton/HeaderButton";
import PageHeader from "../../../components/PageHeader/PageHeader";
import Card from "../../../components/Card/Card";
import styles from "./AdminMyAssetsPage.module.css";

//API 연동 시 대체 예정
const MOCK_SW_DASHBOARD = [
  {
    // 일반 케이스: 미사용 있음
    id: 1,
    name: "Office 365",
    totalCount: 10,
    activeCount: 7,
    inactiveCount: 3,
    licenses: [
      { id: 1, key: "ABCD-1234-EFGH-5678", user: "kim@company.com" },
      { id: 2, key: "IJKL-9012-MNOP-3456", user: "lee@company.com" },
      { id: 3, key: "QRST-7890-UVWX-1234", user: "park@company.com" },
      { id: 4, key: "YZAB-5678-CDEF-9012", user: "choi@company.com" },
      { id: 5, key: "GHIJ-3456-KLMN-7890", user: "jung@company.com" },
      { id: 6, key: "OPQR-1234-STUV-5678", user: "yoon@company.com" },
      { id: 7, key: "WXYZ-9012-ABCD-3456", user: "han@company.com" },
    ],
  },
  {
    // 일반 케이스: 미사용 있음
    id: 2,
    name: "Slack",
    totalCount: 20,
    activeCount: 18,
    inactiveCount: 2,
    licenses: [
      { id: 8,  key: "SLCK-1111-AAAA-0001", user: "kim@company.com" },
      { id: 9,  key: "SLCK-2222-BBBB-0002", user: "lee@company.com" },
      { id: 10, key: "SLCK-3333-CCCC-0003", user: "park@company.com" },
    ],
  },
  {
    // 미사용 = 0 케이스: '-' 표시 확인
    id: 3,
    name: "Figma",
    totalCount: 5,
    activeCount: 5,
    inactiveCount: 0,
    licenses: [
      { id: 11, key: "FGMA-AAAA-1111-ZZZZ", user: "design1@company.com" },
      { id: 12, key: "FGMA-BBBB-2222-YYYY", user: "design2@company.com" },
      { id: 13, key: "FGMA-CCCC-3333-XXXX", user: "design3@company.com" },
      { id: 14, key: "FGMA-DDDD-4444-WWWW", user: "design4@company.com" },
      { id: 15, key: "FGMA-EEEE-5555-VVVV", user: "design5@company.com" },
    ],
  },
  {
    // 라이선스 빈 배열 케이스: 빈 상태 메시지 확인
    id: 4,
    name: "Adobe XD",
    totalCount: 3,
    activeCount: 0,
    inactiveCount: 3,
    licenses: [],
  },
];

// API 연동 시 대체 예정
const MOCK_PC_DASHBOARD = [
  {
    // 일반 케이스: 미사용 있음
    id: 1,
    category: "노트북",
    totalCount: 20,
    activeCount: 17,
    inactiveCount: 3,
  },
  {
    // 일반 케이스: 미사용 있음
    id: 2,
    category: "데스크탑",
    totalCount: 10,
    activeCount: 8,
    inactiveCount: 2,
  },
  {
    // 미사용 = 0 케이스: '-' 표시 확인
    id: 3,
    category: "모니터",
    totalCount: 15,
    activeCount: 15,
    inactiveCount: 0,
  },
];

const AdminMyAssetsPage = () => {
  const navigate = useNavigate();

  // SW 대시보드 아코디언 상태
  const [openSwId, setOpenSwId] = useState(new Set());

  // 각 패널의 실제 높이 (useLayoutEffect로 측정)
  const panelRefs    = useRef({});
  const [panelHeights, setPanelHeights] = useState({});

  useLayoutEffect(() => {
    const heights = {};
    MOCK_SW_DASHBOARD.forEach((sw) => {
      const el = panelRefs.current[sw.id];
      if (el) heights[sw.id] = el.scrollHeight;
    });
    setPanelHeights(heights);
  }, []);

  return (
    <div className={styles.page}>
      <PageHeader
        title="내 자산 관리"
        desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요."
        actions={
          <>
            <HeaderButton label="자산 등록" onClick={() => navigate("/admin/my-assets/request")} />
            <HeaderButton label="요청 내역" onClick={() => navigate("/admin/my-assets/request-history")} />
          </>
        }
      />

      {/* 섹션 0: SW 현황 대시보드 */}
      <section className={styles.section}>
        <div className={styles.swDashboardTitleBar}>
          <span className={styles.swDashboardTitleText}>전체 SW 현황</span>
          <div className={styles.swDashboardTitleRight}>
            <span className={styles.swDashboardTitleCount}>총 {MOCK_SW_DASHBOARD.reduce((sum, sw) => sum + sw.totalCount, 0)}건</span>
            <button type="button" className={styles.swDashboardViewBtn} onClick={() => navigate("/admin/sw-assets")}>조회 &gt;</button>
          </div>
        </div>

        <Card>
          {/* 헤더 행 */}
          <div className={styles.swDashboardHeader}>
            <span className={styles.swDashboardHeaderName}>소프트웨어명</span>
            <span className={styles.swDashboardHeaderCount}>총 수량</span>
            <span className={styles.swDashboardHeaderCount}>사용 중</span>
            <span className={styles.swDashboardHeaderCount}>미사용</span>
            <span className={styles.swDashboardHeaderChevron} />
          </div>

          {/* 아코디언 목록 */}
          <ul className={styles.swDashboardList}>
            {MOCK_SW_DASHBOARD.map((sw) => {
              const isOpen = openSwId.has(sw.id);
              return (
                <li key={sw.id} className={styles.swDashboardItem}>
                  {/* 소프트웨어 행 */}
                  <button
                    type="button"
                    className={`${styles.swDashboardRow} ${isOpen ? styles.swDashboardRowOpen : ""}`}
                    onClick={() => setOpenSwId((prev) => { const next = new Set(prev); isOpen ? next.delete(sw.id) : next.add(sw.id); return next; })}
                  >
                    <span className={styles.swDashboardName}>{sw.name}</span>
                    <span className={styles.swDashboardCount}>{sw.totalCount}</span>
                    <span className={styles.swDashboardCount}>{sw.activeCount}</span>
                    <span className={`${styles.swDashboardCount} ${sw.inactiveCount > 0 ? styles.swDashboardCountWarning : styles.swDashboardCountZero}`}>
                      {sw.inactiveCount > 0 ? sw.inactiveCount : "-"}
                    </span>
                    <span className={`${styles.swDashboardChevron} ${isOpen ? styles.swDashboardChevronOpen : ""}`}>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {/* 펼쳐지는 라이선스 목록 */}
                  <div
                    ref={el => panelRefs.current[sw.id] = el}
                    className={`${styles.swLicensePanel} ${isOpen ? styles.swLicensePanelOpen : ""}`}
                    style={{ maxHeight: isOpen ? (panelHeights[sw.id] ?? 0) + 'px' : '0px' }}
                  >
                    {sw.licenses.length === 0 ? (
                      <p className={styles.swLicenseEmpty}>사용 중인 라이선스가 없습니다.</p>
                    ) : (
                      <table className={styles.swLicenseTable}>
                        <thead>
                          <tr>
                            <th>라이선스 키</th>
                            <th>사용자</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sw.licenses.map((license) => (
                            <tr key={license.id}>
                              <td>{license.key}</td>
                              <td>{license.user}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {/* 섹션 0-1: PC 현황 대시보드 */}
      <section className={styles.section}>
        <div className={styles.swDashboardTitleBar}>
          <span className={styles.swDashboardTitleText}>전체 PC 현황</span>
          <div className={styles.swDashboardTitleRight}>
            <span className={styles.swDashboardTitleCount}>총 {MOCK_PC_DASHBOARD.reduce((sum, pc) => sum + pc.totalCount, 0)}건</span>
            <button type="button" className={styles.swDashboardViewBtn} onClick={() => navigate("/admin/pc-assets")}>조회 &gt;</button>
          </div>
        </div>

        <Card>
          {/* 헤더 행 */}
          <div className={styles.pcDashboardHeader}>
            <span className={styles.swDashboardHeaderName}>자산 종류</span>
            <span className={styles.swDashboardHeaderCount}>총 수량</span>
            <span className={styles.swDashboardHeaderCount}>사용 중</span>
            <span className={styles.swDashboardHeaderCount}>미사용</span>
          </div>

          {/* 목록 */}
          <ul className={styles.swDashboardList}>
            {MOCK_PC_DASHBOARD.map((pc) => (
              <li key={pc.id} className={styles.swDashboardItem}>
                <div className={styles.pcDashboardRow}>
                  <span className={styles.swDashboardName}>{pc.category}</span>
                  <span className={styles.swDashboardCount}>{pc.totalCount}</span>
                  <span className={styles.swDashboardCount}>{pc.activeCount}</span>
                  <span className={`${styles.swDashboardCount} ${pc.inactiveCount > 0 ? styles.swDashboardCountWarning : styles.swDashboardCountZero}`}>
                    {pc.inactiveCount > 0 ? pc.inactiveCount : "-"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
};

export default AdminMyAssetsPage;
