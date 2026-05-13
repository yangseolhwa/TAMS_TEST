import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'react-bootstrap-icons'
import toast from 'react-hot-toast'
import PageHeader from '../../../components/PageHeader/PageHeader'
import TabCard from '../../../components/TabCard/TabCard'
import ActionButton from '../../../components/ActionButton/ActionButton'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal'
import DataTable from '../../../components/DataTable/DataTable'
import Banner from '../../../components/Banner/Banner'
import { matchesAnyField } from '../../../utils/koreanSearch'
import {
  fetchEnterpriseAvailable,
  fetchSwAvailable,
  requestEnterpriseAssign,
  requestSwAssign,
} from '../../../services/assetService'
import common from '../../AssetPage.common.module.css'
import styles from './UserAssetAssignPage.module.css'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'pc', label: 'PC 할당' },
  { id: 'sw', label: 'SW 할당' },
]
// ─────────────────────────────────────────────────────────────────────────────

const UserAssetAssignPage = () => {
  const queryClient = useQueryClient()

  // ── 탭 ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('pc')

  // ── PC 필터 ───────────────────────────────────────────────────────────────
  const [pcKeyword,        setPcKeyword]        = useState('')
  const [pcAppliedKeyword, setPcAppliedKeyword] = useState('')

  // ── SW 필터 ───────────────────────────────────────────────────────────────
  const [swKeyword,        setSwKeyword]        = useState('')
  const [swAppliedKeyword, setSwAppliedKeyword] = useState('')

  // ── 요청 사유 상태 ────────────────────────────────────────────────────────
  // PC: { [assetId]: string }
  // SW: { [swId]: string }
  const [pcReasonState, setPcReasonState] = useState({})
  const [swReasonState, setSwReasonState] = useState({})

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

  // ── 클라이언트 키워드 필터 (초성 검색 포함) ────────────────────────────────
  const filteredPcList = useMemo(() => {
    if (!pcAppliedKeyword) return pcList
    return pcList.filter((item) =>
      matchesAnyField(
        [item.manufacturer, item.serial_number, item.spec, item.location, item.item_number],
        pcAppliedKeyword
      )
    )
  }, [pcList, pcAppliedKeyword])

  const filteredSwList = useMemo(() => {
    return swList
      .filter((item) => (item.available_count ?? 0) > 0)
      .filter((item) => {
        if (!swAppliedKeyword) return true
        return matchesAnyField(
          [item.name, item.manufacturer, item.version],
          swAppliedKeyword
        )
      })
  }, [swList, swAppliedKeyword])

  // ── Mutations ─────────────────────────────────────────────────────────────
  const pcRequestMutation = useMutation({
    mutationFn: ({ assetId, requestReason }) =>
      requestEnterpriseAssign({
        asset_id: assetId,
        ...(requestReason?.trim() && { request_reason: requestReason.trim() }),
      }),
    onSuccess: (res) => {
      toast.success(res?.message ?? '할당 요청이 완료되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['enterpriseAvailable'] })
      queryClient.invalidateQueries({ queryKey: ['assetRequests'] })
      setPcReasonState({})
      setConfirm(null)
    },
    onError: (err) => { toast.error(err.message); setConfirm(null) },
  })

  const swRequestMutation = useMutation({
    mutationFn: ({ swId, licenseId, requestReason }) =>
      requestSwAssign({
        asset_sw_id: swId,
        ...(licenseId && { license_id: licenseId }),
        ...(requestReason?.trim() && { request_reason: requestReason.trim() }),
      }),
    onSuccess: (res) => {
      toast.success(res?.message ?? '할당 요청이 완료되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['swAvailable'] })
      queryClient.invalidateQueries({ queryKey: ['assetRequests'] })
      setSwReasonState({})
      setConfirm(null)
    },
    onError: (err) => { toast.error(err.message); setConfirm(null) },
  })

  const isMutating = pcRequestMutation.isPending || swRequestMutation.isPending

  // ── PC 요청 버튼 클릭 ─────────────────────────────────────────────────────
  const handlePcRequestClick = (assetId, assetLabel) => {
    setConfirm({
      type:          'pc',
      assetId,
      assetLabel,
      requestReason: pcReasonState[assetId] ?? '',
    })
  }

  // ── SW 요청 버튼 클릭 ─────────────────────────────────────────────────────
  // 라이선스형: available_licenses[0].id 자동 선택
  // 구독형: license_id 없이 asset_sw_id만 전송
  const handleSwRequestClick = (sw) => {
    const licenseId = sw.license_required
      ? (sw.available_licenses?.[0]?.id ?? null)
      : null

    setConfirm({
      type:          'sw',
      swId:          sw.id,
      licenseId,
      assetLabel:    sw.name,
      requestReason: swReasonState[sw.id] ?? '',
    })
  }

  // ── 확인 버튼 ─────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!confirm) return
    if (confirm.type === 'pc') {
      pcRequestMutation.mutate({ assetId: confirm.assetId, requestReason: confirm.requestReason })
    } else {
      swRequestMutation.mutate({ swId: confirm.swId, licenseId: confirm.licenseId, requestReason: confirm.requestReason })
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
      key: 'request_reason',
      label: '요청 사유',
      width: '200px',
      renderCell: (row) => (
        <input
          className={styles.inlineInput}
          type="text"
          placeholder="요청 사유 (선택)"
          value={pcReasonState[row.id] ?? ''}
          onChange={(e) =>
            setPcReasonState((prev) => ({ ...prev, [row.id]: e.target.value }))
          }
        />
      ),
    },
    {
      key: 'request_btn',
      label: '요청',
      width: '64px',
      renderCell: (row) => (
        <ActionButton
          variant="blue"
          size="xxs"
          label="요청"
          disabled={isMutating}
          onClick={() => handlePcRequestClick(row.id, row.itemNumber ?? row.itemTypeName ?? `자산 #${row.id}`)}
        />
      ),
    },
  ], [pcReasonState, isMutating])

  // ── SW DataTable rows ─────────────────────────────────────────────────────
  const swRows = useMemo(() =>
    filteredSwList.map((sw, i) => ({
      id:           sw.id,
      no:           i + 1,
      name:         sw.name         ?? null,
      manufacturer: sw.manufacturer ?? null,
      version:      sw.version      ?? null,
      availableCount: sw.available_count ?? null,
      // renderCell에서 sw 원본 객체가 필요하므로 보관
      _raw: sw,
    })),
  [filteredSwList])

  // ── SW DataTable columns ──────────────────────────────────────────────────
  const swColumns = useMemo(() => [
    { key: 'no',             label: 'No',        width: '48px' },
    { key: 'name',           label: '소프트웨어명', type: 'dash' },
    { key: 'manufacturer',   label: '제조사',    type: 'dash'  },
    { key: 'version',        label: '버전',      type: 'dash'  },
    { key: 'availableCount', label: '남은 수량', type: 'dash'  },
    {
      key: 'request_reason',
      label: '요청 사유',
      width: '200px',
      renderCell: (row) => (
        <input
          className={styles.inlineInput}
          type="text"
          placeholder="요청 사유 (선택)"
          value={swReasonState[row.id] ?? ''}
          onChange={(e) =>
            setSwReasonState((prev) => ({ ...prev, [row.id]: e.target.value }))
          }
        />
      ),
    },
    {
      key: 'request_btn',
      label: '요청',
      width: '64px',
      renderCell: (row) => (
        <ActionButton
          variant="blue"
          size="xxs"
          label="요청"
          disabled={isMutating}
          onClick={() => handleSwRequestClick(row._raw)}
        />
      ),
    },
  ], [swReasonState, isMutating])

  // ── 렌더링 ────────────────────────────────────────────────────────────────
  return (
    <div className={common.page}>
      <PageHeader
        title="내 자산 할당 요청"
        desc="사용 가능한 PC · SW 자산을 선택해 할당을 요청합니다."
      />

      <section className={common.section}>
        <TabCard tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
          <Banner
            text={<>관리자 <strong>승인 후</strong> 자산이 할당됩니다. 요청 상태는 <strong>내 자산 요청 내역</strong>에서 확인할 수 있습니다.</>}
          />

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
              <DataTable
                columns={swColumns}
                rows={swLoading ? [] : swRows}
                selectable={false}
                totalCount={swRows.length}
                highlight={swAppliedKeyword}
              />
            </>
          )}

        </TabCard>
      </section>

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm ? `"${confirm.assetLabel}" 할당을 요청할까요?` : ''}
        desc="관리자 승인 후 자산이 할당됩니다."
        confirmLabel="요청"
        confirmVariant="primary"
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

export default UserAssetAssignPage
