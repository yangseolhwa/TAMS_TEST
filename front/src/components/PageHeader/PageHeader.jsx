import { Link, useLocation } from "react-router-dom";
import styles from "./PageHeader.module.css";
import PropTypes from 'prop-types';

// URL 세그먼트 → 한글 라벨 매핑
const SEGMENT_LABEL_MAP = {
  // 역할
  admin: null,
  user:  null,

  // 대분류
  'my-assets': '내 자산 관리',
  'df-assets': 'DF 자산 관리',

  // 내 자산 관리 하위
  'request':         '내 자산 등록',
  'assign':          '내 자산 할당',
  'request-history': '내 자산 요청 내역',
  'history':         '내 자산 히스토리',

  // PC / SW 전체 조회 (my-assets 하위가 아닌 별도 경로)
  'pc-assets': 'PC 전체 조회',
  'sw-assets': 'SW 전체 조회',

  // DF 자산 관리 하위
  'dashboard': 'DF 자산 현황',
  'register':  'DF 자산 등록',
  'list':      'DF 자산 전체 조회',
  'by-project':'DF 자산 현황',
}

// user role일 때 세그먼트 라벨 덮어쓰기
const USER_SEGMENT_OVERRIDES = {
  'request':  '내 자산 등록 요청',
  'assign':   '내 자산 할당 요청',
  'history':  '내 자산 요청 내역',
}

const PageHeader = ({ title, breadcrumbExtra }) => {
  const location = useLocation()
  const today = new Date()
  const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`

  // pathname 파싱해서 breadcrumb 아이템 생성
  //
  // KRDS 가이드라인:
  // - 첫 항목은 메인 화면(HOME) 링크
  // - 마지막 항목은 현재 페이지의 상위 화면 링크 (현재 페이지는 title로 표시하므로 제외)
  // - 모든 항목은 링크로 제공
  const buildBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean)
    const role = parts[0]  // 'admin' | 'user'
    const items = []

    // HOME은 항상 첫 번째 링크
    items.push({ label: 'HOME', to: `/${role}/my-assets` })

    // pc-assets / sw-assets: URL에 my-assets가 없으므로 수동으로 상위 경로 추가
    if (parts[1] === 'pc-assets' || parts[1] === 'sw-assets') {
      items.push({ label: '내 자산 관리', to: `/${role}/my-assets` })
      // 현재 페이지(pc-assets/sw-assets)는 title로 표시되므로 breadcrumb에 추가하지 않음
      return items
    }

    // my-assets 목록 페이지: HOME만 표시 (현재 페이지 = HOME이므로 상위 없음)
    if (parts[1] === 'my-assets' && parts.length === 2) {
      return items
    }

    // 나머지 세그먼트 순회 — 마지막 세그먼트(현재 페이지)는 제외
    const segmentsWithoutLast = parts.slice(1, -1)

    segmentsWithoutLast.forEach((segment, idx) => {
      let label = SEGMENT_LABEL_MAP[segment]

      // user role 덮어쓰기
      if (role === 'user' && USER_SEGMENT_OVERRIDES[segment]) {
        label = USER_SEGMENT_OVERRIDES[segment]
      }

      // null이면 breadcrumb에서 제외
      if (label === null || label === undefined) return

      // df-assets 세그먼트는 /dashboard로 링크 (해당 경로 자체는 없음)
      const fullIdx = idx + 1  // parts에서의 실제 인덱스 (role 제외 후 +1)
      const to = segment === 'df-assets'
        ? `/${role}/df-assets/dashboard`
        : '/' + parts.slice(0, fullIdx + 1).join('/')

      items.push({ label, to })
    })

    // breadcrumbExtra가 있으면 마지막에 현재 위치로 추가 (링크 없음)
    if (breadcrumbExtra) {
      items.push({ label: breadcrumbExtra, to: null })
    }

    return items
  }

  const breadcrumbs = buildBreadcrumbs()

  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderLeft}>
        {/* Breadcrumb */}
        {breadcrumbs.length > 0 && (
          <nav className={styles.breadcrumbWrap}>
            <ol className={styles.breadcrumb}>
              {breadcrumbs.map((item, idx) => (
                <li key={idx} className={styles.breadcrumbItem}>
                  {idx > 0 && <span className={styles.breadcrumbSeparator}>&gt;</span>}
                  {item.to ? (
                    <Link to={item.to} className={styles.breadcrumbLink}>{item.label}</Link>
                  ) : (
                    <span className={styles.breadcrumbCurrent}>{item.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Title */}
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>

      <div className={styles.pageHeaderRight}>
        <span className={styles.pageDate}>{formattedDate} 기준</span>
      </div>
    </div>
  );
};

PageHeader.propTypes = {
  title:           PropTypes.string.isRequired,
  breadcrumbExtra: PropTypes.string,
};

export default PageHeader;
