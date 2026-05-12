import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronUp } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import PageHeader from '../../../components/PageHeader/PageHeader'
import TabCard from '../../../components/TabCard/TabCard'
import ActionButton from '../../../components/ActionButton/ActionButton'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal'
import DataTable from '../../../components/DataTable/DataTable'
import {
  fetchEnterpriseAvailable,
  fetchSwAvailable,
  fetchUsers,
  assignEnterpriseAsset,
  assignSwLicense,
} from '../../../services/assetService'
import common from '../../AssetPage.common.module.css'
import styles from './AdminAssetAssignPage.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'pc', label: 'PC 할당' },
  { id: 'sw', label: 'SW 할당' },
]
// ─────────────────────────────────────────────────────────────────────────────

const AdminAssetAssignPage = () => {
  const queryClient = useQueryClient()

  // ── 탭 ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('pc')

  // ── PC 필터 ───────────────────────────────────────────────────────────────
  const [pcKeyword,        setPcKeyword]        = useState('')
  const [pcAppliedKeyword, setPcAppliedKeyword] = useState('')

  // ── SW 필터 ───────────────────────────────────────────────────────────────
  const [swKeyword,        setSwKeyword]        = useState('')
  const [swAppliedKeyword, setSwAppliedKeyword] = useState('')

  // ── SW 아코디언 열린 SW id 집합 ──────────────────────────────────────────
  const [openSwIds, setOpenSwIds] = useState(new Set())

  // ── 라이선스 패널 높이 측정용 ─────────────────────────────────────────────
  const panelRefs      = useRef({})
  const [panelHeights, setPanelHeights] = useState({})

  // ── PC 할당 행 상태: { [assetId]: { userId } } ───────────────────────────
  const [pcAssignState, setPcAssignState] = useState({})

  // ── SW 라이선스 할당 행 상태: { [licenseId]: { userId } } ────────────────
  const [swAssignState, setSwAssignState] = useState({})

  // ── 확인 모달 ─────────────────────────────────────────────────────────────
  const [confirm, setConfirm] = useState(null)

  // ── 데이터 조회 ───────────────────────────────────────────────────────────
  const { data: pcList = [], isLoading: pcLoading } = useQuery({
    queryKey: ['enterpriseAvailable'],
    queryFn:  fetchEnterpriseAvailable,
  })

  const { data: swList = [], isLoading: swLoading } = useQuery({
    queryKey: ['swAvailable'],
    queryFn:  fetchSwAvailable,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  () => fetchUsers(),
  })

  // ── 필터링 ────────────────────────────────────────────────────────────────
  const filteredPcList = useMemo(() => {
    if (!pcAppliedKeyword) return pcList
    const kw = pcAppliedKeyword.toLowerCase()
    return pcList.filter((item) =>
      [item.manufacturer, item.serial_number, item.spec, item.location, item.item_number]
        .filter(Boolean).join(' ').toLowerCase().includes(kw)
    )
  }, [pcList, pcAppliedKeyword])

  const filteredSwList = useMemo(() => {
    if (!swAppliedKeyword) return swList
    const kw = swAppliedKeyword.toLowerCase()
    return swList.filter((item) =>
      [item.name, item.manufacturer, item.version]
        .filter(Boolean).join(' ').toLowerCase().includes(kw)
    )
  }, [swList, swAppliedKeyword])

  // ── Mutations (isMutating은 pcColumns useMemo보다 반드시 먼저 선언) ───────
  const pcAssignMutation = useMutation({
    mutationFn: ({ assetId, userId }) => assignEnterpriseAsset({ asset_id: assetId, user_id: userId }),
    onSuccess: (res) => {
      toast.success(res?.message ?? '자산이 할당되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['enterpriseAvailable'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['personalHistory'] })
      setPcAssignState((prev) => { const next = { ...prev }; delete next[confirm.assetId]; return next })
      setConfirm(null)
    },
    onError: (err) => { toast.error(err.message); setConfirm(null) },
  })

  const swAssignMutation = useMutation({
    mutationFn: (body) => assignSwLicense(body),
    onSuccess: (res) => {
      toast.success(res?.message ?? 'SW가 할당되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['swAvailable'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['personalHistory'] })
      setSwAssignState((prev) => {
        const next = { ...prev }
        if (confirm.type === 'sw-subscription') delete next[`sw-${confirm.swId}`]
        else delete next[confirm.licenseId]
        return next
      })
      setConfirm(null)
    },
    onError: (err) => { toast.error(err.message); setConfirm(null) },
  })

  const isMutating = pcAssignMutation.isPending || swAssignMutation.isPending

  // ── PC 할당 버튼 클릭 ─────────────────────────────────────────────────────
  const handlePcAssignClick = (assetId) => {
    const userId = pcAssignState[assetId]?.userId
    if (!userId) { toast.error('사용자를 선택해주세요.'); return }
    const user = users.find((u) => u.id === Number(userId))
    const item = pcList.find((i) => i.id === assetId)
    setConfirm({
      type:       'pc',
      assetId,
      userId:     Number(userId),
      userName:   user?.name ?? user?.email ?? '선택된 사용자',
      assetLabel: item?.item_number ?? `자산 #${assetId}`,
    })
  }

  // ── SW 구독형 할당 버튼 클릭 ─────────────────────────────────────────────
  const handleSwSubscriptionAssignClick = (swId, swName) => {
    const userId = swAssignState[`sw-${swId}`]?.userId
    if (!userId) { toast.error('사용자를 선택해주세요.'); return }
    const user = users.find((u) => u.id === Number(userId))
    setConfirm({
      type:       'sw-subscription',
      swId:       Number(swId),
      userId:     Number(userId),
      userName:   user?.name ?? user?.email ?? '선택된 사용자',
      assetLabel: swName,
    })
  }

  // ── SW 라이선스 할당 버튼 클릭 ────────────────────────────────────────────
  const handleSwAssignClick = (licenseId, swName) => {
    const userId = swAssignState[licenseId]?.userId
    if (!userId) { toast.error('사용자를 선택해주세요.'); return }
    const user = users.find((u) => u.id === Number(userId))
    setConfirm({
      type:       'sw',
      licenseId:  Number(licenseId),
      userId:     Number(userId),
      userName:   user?.name ?? user?.email ?? '선택된 사용자',
      assetLabel: swName,
    })
  }

  const handleConfirm = () => {
    if (!confirm) return
    if (confirm.type === 'pc') {
      pcAssignMutation.mutate({ assetId: confirm.assetId, userId: confirm.userId })
    } else if (confirm.type === 'sw-subscription') {
      swAssignMutation.mutate({ asset_sw_id: confirm.swId, user_id: confirm.userId })
    } else {
      swAssignMutation.mutate({ license_id: confirm.licenseId, user_id: confirm.userId })
    }
  }

  // ── PC DataTable rows ─────────────────────────────────────────────────────
  const pcRows = useMemo(() =>
    filteredPcList.map((item, i) => ({
      id:           item.id,
      no:           i + 1,
      itemNumber:   item.item_number     ?? null,
      itemTypeName: item.item_type?.name ?? null,
      manufacturer: item.manufacturer   ?? null,
      spec:         item.spec           ?? null,
      serialNumber: item.serial_number  ?? null,
      location:     item.location       ?? null,
    })),
  [filteredPcList])

  // ── PC DataTable columns ──────────────────────────────────────────────────
  const pcColumns = useMemo(() => [
    { key: 'no',           label: 'No',        width: '48px' },
    { key: 'itemNumber',   label: '자산번호',  type: 'dash'  },
    { key: 'itemTypeName', label: '자산 종류', type: 'dash'  },
    { key: 'manufacturer', label: '제조사',    type: 'dash'  },
    { key: 'spec',         label: '규격',      type: 'dash'  },
    { key: 'serialNumber', label: '시리얼',    type: 'dash'  },
    { key: 'location',     label: '위치',      type: 'dash'  },
    {
      key: 'assign_user',
      label: '담당자 지정',
      width: '200px',
      renderCell: (row) => {
        const userId = pcAssignState[row.id]?.userId ?? ''
        return (
          <select
            className={styles.inlineSelect}
            value={userId}
            onChange={(e) =>
              setPcAssignState((prev) => ({
                ...prev,
                [row.id]: { userId: e.target.value },
              }))
            }
          >
            <option value="">사용자 선택</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ? `${u.name} (${u.email})` : u.email}
              </option>
            ))}
          </select>
        )
      },
    },
    {
      key: 'assign_btn',
      label: '할당',
      width: '64px',
      renderCell: (row) => {
        const userId = pcAssignState[row.id]?.userId ?? ''
        return (
          <ActionButton
            variant="blue"
            size="xxs"
            label="할당"
            disabled={!userId || isMutating}
            onClick={() => handlePcAssignClick(row.id)}
          />
        )
      },
    },
  ], [pcAssignState, users, isMutating, pcList])

  // ── SW 아코디언 토글 ──────────────────────────────────────────────────────
  const toggleSwAccordion = (swId) => {
    const el = panelRefs.current[swId]
    if (el) {
      setPanelHeights((prev) => ({ ...prev, [swId]: el.scrollHeight }))
    }
    setOpenSwIds((prev) => {
      const next = new Set(prev)
      prev.has(swId) ? next.delete(swId) : next.add(swId)
      return next
    })
  }

  // ── SW 아코디언 렌더링 ────────────────────────────────────────────────────
  const renderSwAccordion = () => {
    if (swLoading) return <div className={styles.empty}>불러오는 중...</div>
    if (filteredSwList.length === 0) return <div className={styles.empty}>할당 가능한 SW 자산이 없습니다.</div>

    const subscriptionList = filteredSwList.filter((sw) => sw.license_required === false && (sw.available_count ?? 0) > 0)
    const licensedList     = filteredSwList.filter((sw) => sw.license_required !== false)
    const hasBothTypes     = subscriptionList.length > 0 && licensedList.length > 0

    const renderSubscriptionRow = (sw) => {
      const swUserId = swAssignState[`sw-${sw.id}`]?.userId ?? ''
      return (
        <div key={sw.id} className={`${styles.swAccordionItem} ${styles.swFlatRow}`}>
          <div className={styles.swAccordionCell}>{sw.name ?? '—'}</div>
          <div className={styles.swAccordionCell}>{sw.manufacturer ?? '—'}</div>
          <div className={styles.swAccordionCell}>{sw.version ?? '—'}</div>
          <div className={styles.swAccordionCell}>{sw.available_count ?? '—'}</div>
          <div className={styles.swAccordionCell}>
            <select
              className={styles.inlineSelect}
              value={swUserId}
              onChange={(e) =>
                setSwAssignState((prev) => ({
                  ...prev,
                  [`sw-${sw.id}`]: { userId: e.target.value },
                }))
              }
            >
              <option value="">사용자 선택</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ? `${u.name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.swAccordionCell}>
            <ActionButton
              variant="blue"
              size="xxs"
              label="할당"
              disabled={!swUserId || isMutating}
              onClick={() => handleSwSubscriptionAssignClick(sw.id, sw.name)}
            />
          </div>
        </div>
      )
    }

    const renderLicensedRow = (sw) => {
      const isOpen   = openSwIds.has(sw.id)
      const licenses = (sw.available_licenses ?? []).filter((lic, idx) =>
        lic.license_type === 'shared' ? idx === 0 : true
      )
      return (
        <div key={sw.id} className={styles.swAccordionItem}>
          <button
            type="button"
            className={`${styles.swAccordionRow} ${isOpen ? styles.swAccordionRowOpen : ''}`}
            onClick={() => toggleSwAccordion(sw.id)}
          >
            <div className={styles.swAccordionCell}>{sw.name ?? '—'}</div>
            <div className={styles.swAccordionCell}>{sw.manufacturer ?? '—'}</div>
            <div className={styles.swAccordionCell}>{sw.version ?? '—'}</div>
            <div className={styles.swAccordionCell}>{sw.available_count ?? '—'}</div>
            <div className={styles.swAccordionCell} />
            <div className={styles.swAccordionChevron}>
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          <div
            ref={(el) => (panelRefs.current[sw.id] = el)}
            className={`${styles.licensePanel} ${isOpen ? styles.licensePanelOpen : ''}`}
            style={{ maxHeight: isOpen ? (panelHeights[sw.id] ?? 0) + 'px' : '0px' }}
          >
            {licenses.map((lic) => {
              const userId = swAssignState[lic.id]?.userId ?? ''
              const licenseDisplay = lic.key_type === 'credential'
                ? `${lic.license_key ?? '—'} / ${lic.license_password ?? '—'}`
                : (lic.license_key ?? '—')
              return (
                <div key={lic.id} className={styles.licenseRow}>
                  <div className={styles.licenseTd}>{licenseDisplay}</div>
                  <div className={styles.licenseTd}>
                    <select
                      className={styles.inlineSelect}
                      value={userId}
                      onChange={(e) =>
                        setSwAssignState((prev) => ({
                          ...prev,
                          [lic.id]: { userId: e.target.value },
                        }))
                      }
                    >
                      <option value="">사용자 선택</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ? `${u.name} (${u.email})` : u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.licenseTd}>
                    <ActionButton
                      variant="blue"
                      size="xxs"
                      label="할당"
                      disabled={!userId || isMutating}
                      onClick={() => handleSwAssignClick(lic.id, sw.name)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className={styles.swAccordion}>
        {/* 공통 헤더 */}
        <div className={styles.swAccordionHeader}>
          <div className={styles.th}>소프트웨어명</div>
          <div className={styles.th}>제조사</div>
          <div className={styles.th}>버전</div>
          <div className={styles.th}>남은 수량</div>
          <div className={styles.th}>담당자 지정</div>
          <div className={styles.th}>할당</div>
        </div>

        {/* 구독형 그룹 */}
        {subscriptionList.length > 0 && (
          <>
            {hasBothTypes && <div className={styles.groupTitle}>구독형</div>}
            {subscriptionList.map(renderSubscriptionRow)}
          </>
        )}

        {/* 라이선스형 그룹 */}
        {licensedList.length > 0 && (
          <>
            {hasBothTypes && <div className={styles.groupTitle}>라이선스형</div>}
            {licensedList.map(renderLicensedRow)}
          </>
        )}
      </div>
    )
  }

  // ── 렌더링 ────────────────────────────────────────────────────────────────
  return (
    <div className={common.page}>
      <PageHeader
        title="자산 할당"
        desc="미사용 PC · SW 자산을 사용자에게 할당합니다."
      />

      <section className={common.section}>
        <TabCard tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>

          {/* PC 탭 */}
          {activeTab === 'pc' && (
            <>
              <div className={common.filterArea}>
                <div className={common.filterSearchWrap}>
                  <input
                    type="text"
                    className={common.filterInput}
                    placeholder="제조사 / 시리얼 / 규격 / 위치 검색"
                    value={pcKeyword}
                    onChange={(e) => setPcKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setPcAppliedKeyword(pcKeyword)}
                  />
                  <button className={common.filterSearchBtn} onClick={() => setPcAppliedKeyword(pcKeyword)}>
                    <Search size={14} />
                  </button>
                </div>
              </div>
              <DataTable
                columns={pcColumns}
                rows={pcLoading ? [] : pcRows}
                selectable={false}
                totalCount={pcRows.length}
                highlight={pcAppliedKeyword}
              />
            </>
          )}

          {/* SW 탭 */}
          {activeTab === 'sw' && (
            <>
              <div className={common.filterArea}>
                <div className={common.filterSearchWrap}>
                  <input
                    type="text"
                    className={common.filterInput}
                    placeholder="소프트웨어명 / 제조사 검색"
                    value={swKeyword}
                    onChange={(e) => setSwKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setSwAppliedKeyword(swKeyword)}
                  />
                  <button className={common.filterSearchBtn} onClick={() => setSwAppliedKeyword(swKeyword)}>
                    <Search size={14} />
                  </button>
                </div>
              </div>
              {renderSwAccordion()}
              <p className={styles.totalCount}>총 {filteredSwList.length}건</p>
            </>
          )}

        </TabCard>
      </section>

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm ? `"${confirm.assetLabel}"을(를) ${confirm.userName}에게 할당할까요?` : ''}
        desc="할당 후 해당 자산은 사용 중 상태로 변경됩니다."
        confirmLabel="할당"
        confirmVariant="primary"
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

export default AdminAssetAssignPage
