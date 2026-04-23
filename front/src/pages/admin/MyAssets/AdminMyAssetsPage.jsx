import { useState, useRef, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'react-bootstrap-icons'
import PageHeader from '../../../components/PageHeader/PageHeader'
import Card from '../../../components/Card/Card'
import { fetchDashboard } from '../../../services/assetService'
import styles from './AdminMyAssetsPage.module.css'

const AdminMyAssetsPage = () => {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  fetchDashboard,
    refetchOnWindowFocus: false,
  })

  // useMemo로 감싸서 무한루프 방지
  const swList = useMemo(() =>
    (data?.sw?.list ?? []).map((sw) => ({
      id:            sw.id,
      name:          sw.name,
      totalCount:    sw.quantity        ?? 0,
      activeCount:   sw.in_use_count    ?? 0,
      inactiveCount: sw.available_count ?? 0,
      licenses: (sw.licenses ?? []).map((lic) => ({
        id:   lic.id,
        key:  lic.license_key,
        user: lic.user?.name ?? lic.user?.email ?? '-',
      })),
    })),
  [data])

  const pcList = useMemo(() =>
    (data?.enterprise?.by_item_type ?? []).map((t) => ({
      id:       t.id,
      category: t.name,
      total:    t.count ?? 0,
    })),
  [data])

  const swTotal = data?.sw?.total_license_count ?? 0
  const pcTotal = data?.enterprise?.total_count  ?? 0

  const [openSwId,     setOpenSwId]     = useState(new Set())
  const panelRefs                       = useRef({})
  const [panelHeights, setPanelHeights] = useState({})

  useLayoutEffect(() => {
    const heights = {}
    swList.forEach((sw) => {
      const el = panelRefs.current[sw.id]
      if (el) heights[sw.id] = el.scrollHeight
    })
    setPanelHeights(heights)
  }, [swList])

  if (isLoading) {
    return (
      <div className={styles.page}>
        <PageHeader title="내 자산 현황" desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요." />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="내 자산 현황"
        desc="소프트웨어 및 PC 장비 자산을 조회하고 관리하세요."
      />

      {/* SW 현황 대시보드 */}
      <section className={styles.section}>
        <div className={styles.swDashboardTitleBar}>
          <span className={styles.swDashboardTitleText}>전체 SW 현황</span>
          <div className={styles.swDashboardTitleRight}>
            <span className={styles.swDashboardTitleCount}>총 {swTotal}건</span>
            <button type="button" className={styles.swDashboardViewBtn} onClick={() => navigate('/admin/sw-assets')}>
              조회 &gt;
            </button>
          </div>
        </div>

        <Card>
          <div className={styles.swDashboardHeader}>
            <span className={styles.swDashboardHeaderName}>소프트웨어명</span>
            <span className={styles.swDashboardHeaderCount}>총 수량</span>
            <span className={styles.swDashboardHeaderCount}>사용 중</span>
            <span className={styles.swDashboardHeaderCount}>미사용</span>
            <span className={styles.swDashboardHeaderChevron} />
          </div>

          <ul className={styles.swDashboardList}>
            {swList.length === 0 ? (
              <li style={{ padding: '20px 16px', color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' }}>
                데이터가 없습니다.
              </li>
            ) : swList.map((sw) => {
              const isOpen = openSwId.has(sw.id)
              return (
                <li key={sw.id} className={styles.swDashboardItem}>
                  <button
                    type="button"
                    className={`${styles.swDashboardRow} ${isOpen ? styles.swDashboardRowOpen : ''}`}
                    onClick={() =>
                      setOpenSwId((prev) => {
                        const next = new Set(prev)
                        prev.has(sw.id) ? next.delete(sw.id) : next.add(sw.id)
                        return next
                      })
                    }
                  >
                    <span className={styles.swDashboardName}>{sw.name}</span>
                    <span className={styles.swDashboardCount}>{sw.totalCount}</span>
                    <span className={styles.swDashboardCount}>{sw.activeCount}</span>
                    <span className={`${styles.swDashboardCount} ${sw.inactiveCount > 0 ? styles.swDashboardCountWarning : styles.swDashboardCountZero}`}>
                      {sw.inactiveCount > 0 ? sw.inactiveCount : '-'}
                    </span>
                    <span className={`${styles.swDashboardChevron} ${isOpen ? styles.swDashboardChevronOpen : ''}`}>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {/* 라이선스 패널 — 고정 너비 테이블 */}
                  <div
                    ref={(el) => (panelRefs.current[sw.id] = el)}
                    className={`${styles.swLicensePanel} ${isOpen ? styles.swLicensePanelOpen : ''}`}
                    style={{ maxHeight: isOpen ? (panelHeights[sw.id] ?? 0) + 'px' : '0px' }}
                  >
                    {sw.licenses.length === 0 ? (
                      <p className={styles.swLicenseEmpty}>사용 중인 라이선스가 없습니다.</p>
                    ) : (
                      <table className={styles.swLicenseTable}>
                        {/* colgroup으로 열 너비 고정 */}
                        <colgroup>
                          <col style={{ width: '60%' }} />
                          <col style={{ width: '40%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>라이선스 키</th>
                            <th>사용자</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sw.licenses.map((license) => (
                            <tr key={license.id}>
                              <td style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>{license.key}</td>
                              <td>{license.user}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>

      {/* PC 현황 대시보드 */}
      <section className={styles.section}>
        <div className={styles.swDashboardTitleBar}>
          <span className={styles.swDashboardTitleText}>전체 PC 현황</span>
          <div className={styles.swDashboardTitleRight}>
            <span className={styles.swDashboardTitleCount}>총 {pcTotal}건</span>
            <button type="button" className={styles.swDashboardViewBtn} onClick={() => navigate('/admin/pc-assets')}>
              조회 &gt;
            </button>
          </div>
        </div>

        <Card>
          <div className={styles.pcDashboardHeader}>
            <span className={styles.swDashboardHeaderName}>자산 종류</span>
            <span className={styles.swDashboardHeaderCount}>수량</span>
          </div>

          <ul className={styles.swDashboardList}>
            {pcList.length === 0 ? (
              <li style={{ padding: '20px 16px', color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center' }}>
                데이터가 없습니다.
              </li>
            ) : pcList.map((pc) => (
              <li key={pc.id} className={styles.swDashboardItem}>
                <div className={styles.pcDashboardRow}>
                  <span className={styles.swDashboardName}>{pc.category}</span>
                  <span className={styles.swDashboardCount}>{pc.total}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}

export default AdminMyAssetsPage