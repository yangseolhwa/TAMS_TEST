import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import ActionButton from '../../../components/ActionButton/ActionButton'
import PageHeader from '../../../components/PageHeader/PageHeader'
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal'
import Card from '../../../components/Card/Card'
import {
  fetchMyAssets,
  returnEnterpriseAssets,
  returnSwAssets,
  moveEnterpriseAssets,
} from '../../../services/assetService'
import styles from './UserMyAssetsPage.module.css'

// ── 컬럼 정의 ─────────────────────────────────────────────────────────────────
const PC_COLUMNS = [
  { key: 'no',               label: 'No' },
  { key: 'acquisition_date', label: '취득 일자' },
  { key: 'item_type_name',   label: '분류' },
  { key: 'spec',             label: '규격' },
  { key: 'manufacturer',     label: '제조사' },
  { key: 'serial_number',    label: '시리얼 번호' },
  { key: 'location',         label: '위치' },
  { key: 'remarks',          label: '비고' },
]

const SW_COLUMNS = [
  { key: 'no',               label: 'No' },
  { key: 'asset_name',       label: '소프트웨어명' },
  { key: 'version',          label: '버전' },
  { key: 'manufacturer',     label: '제조사' },
  { key: 'license_key',      label: '라이선스 키' },
  { key: 'license_password', label: '라이선스 PW' },
  { key: 'related_link',     label: '관련 링크' },
  { key: 'remarks',          label: '비고' },
]
// ─────────────────────────────────────────────────────────────────────────────

const UserMyAssetsPage = () => {
  const queryClient = useQueryClient()

  // ── 데이터 조회 ───────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['myAssets'],
    queryFn:  fetchMyAssets,
    refetchOnWindowFocus: false,
  })

  const pcRows = useMemo(
    () => (data?.pcRows ?? []).map((r, i) => ({ ...r, no: i + 1 })),
    [data]
  )
  const swRows = useMemo(
    () => (data?.swRows ?? []).map((r, i) => ({ ...r, no: i + 1 })),
    [data]
  )

  // ── PC 이동 모드 ──────────────────────────────────────────────────────────
  const [isMoveMode,    setIsMoveMode]    = useState(false)
  const [locationEdits, setLocationEdits] = useState({})
  const [showMoveConfirm, setShowMoveConfirm] = useState(false)

  // ── 반납 모달 ─────────────────────────────────────────────────────────────
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [returnTarget,      setReturnTarget]      = useState(null) // { type: 'pc'|'sw', rawId, swId? }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['myAssets'] })

  const returnPcMutation = useMutation({
    mutationFn: (rawId) => returnEnterpriseAssets({ asset_ids: [rawId] }),
    onSuccess:  (res) => { toast.success(res?.message ?? '반납되었습니다.'); invalidate(); closeReturn() },
    onError:    (err) => toast.error(err.message),
  })

  const returnSwMutation = useMutation({
    mutationFn: (rawId) => returnSwAssets({ license_ids: [rawId] }),
    onSuccess:  (res) => { toast.success(res?.message ?? '반납되었습니다.'); invalidate(); closeReturn() },
    onError:    (err) => toast.error(err.message),
  })

  const moveMutation = useMutation({
    mutationFn: ({ ids, location }) => moveEnterpriseAssets({ asset_ids: ids, location }),
    onSuccess:  (res) => { toast.success(res?.message ?? '위치가 변경되었습니다.'); invalidate(); cancelMoveMode() },
    onError:    (err) => toast.error(err.message),
  })

  const isMutating = returnPcMutation.isPending || returnSwMutation.isPending || moveMutation.isPending

  // ── 반납 핸들러 ───────────────────────────────────────────────────────────
  const handleReturnClick = (type, rawId, swId) => {
    setReturnTarget({ type, rawId, swId })
    setShowReturnConfirm(true)
  }

  const closeReturn = () => {
    setShowReturnConfirm(false)
    setReturnTarget(null)
  }

  const handleReturnConfirm = () => {
    if (!returnTarget) return
    if (returnTarget.type === 'pc') returnPcMutation.mutate(returnTarget.rawId)
    else                            returnSwMutation.mutate(returnTarget.rawId)
  }

  // ── 이동 핸들러 ───────────────────────────────────────────────────────────
  const handleMoveClick = () => {
    const initEdits = {}
    pcRows.forEach((row) => { initEdits[row.id] = row.location ?? '' })
    setLocationEdits(initEdits)
    setIsMoveMode(true)
  }

  const handleMoveSaveClick = () => setShowMoveConfirm(true)

  const handleMoveConfirm = () => {
    // 변경된 항목만 그룹화 (같은 위치끼리 묶어서 한 번에 요청)
    const locationGroups = {}
    pcRows.forEach((row) => {
      const newLoc = locationEdits[row.id] ?? row.location ?? ''
      if (newLoc !== (row.location ?? '') && newLoc.trim()) {
        if (!locationGroups[newLoc]) locationGroups[newLoc] = []
        locationGroups[newLoc].push(row.rawId)
      }
    })

    const entries = Object.entries(locationGroups)
    if (entries.length === 0) {
      toast('변경된 위치가 없습니다.')
      cancelMoveMode()
      return
    }

    // 위치별로 순차 호출 (일반적으로 1건)
    Promise.allSettled(
      entries.map(([location, ids]) => moveEnterpriseAssets({ asset_ids: ids, location }))
    ).then((results) => {
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length === 0) {
        toast.success('위치가 변경되었습니다.')
      } else {
        toast.error('일부 위치 변경에 실패했습니다.')
      }
      invalidate()
      cancelMoveMode()
    })
  }

  const cancelMoveMode = () => {
    setIsMoveMode(false)
    setLocationEdits({})
    setShowMoveConfirm(false)
  }

  // ── PC 컬럼: 이동 모드에서 위치 셀 input으로 교체 ─────────────────────────
  const pcColumns = useMemo(() => {
    if (!isMoveMode) return PC_COLUMNS
    return PC_COLUMNS.map((col) => {
      if (col.key !== 'location') return col
      return {
        ...col,
        renderCell: (row) => (
          <input
            className={styles.locationInput}
            value={locationEdits[row.id] ?? ''}
            onChange={(e) =>
              setLocationEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
            }
            placeholder="위치 입력"
          />
        ),
      }
    })
  }, [isMoveMode, locationEdits])

  // ── 셀 렌더링 ─────────────────────────────────────────────────────────────
  const renderCell = (col, row) => {
    if (col.renderCell) return col.renderCell(row)
    const value = row[col.key]
    if (col.key === 'related_link') {
      return value
        ? <a className={styles.link} href={value} target="_blank" rel="noreferrer">{value}</a>
        : '—'
    }
    return value ?? '—'
  }

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
                  {SW_COLUMNS.map((col) => <th key={col.key}>{col.label}</th>)}
                  <th className={styles.colAction}>반납</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={SW_COLUMNS.length + 1} className={styles.empty}>불러오는 중...</td></tr>
                ) : swRows.length === 0 ? (
                  <tr><td colSpan={SW_COLUMNS.length + 1} className={styles.empty}>보유한 SW 자산이 없습니다.</td></tr>
                ) : swRows.map((row) => (
                  <tr key={row.id}>
                    {SW_COLUMNS.map((col) => <td key={col.key}>{renderCell(col, row)}</td>)}
                    <td className={styles.colAction}>
                      <ActionButton
                        variant="red" size="xxs" label="반납"
                        onClick={() => handleReturnClick('sw', row.rawId, row.swId)}
                        disabled={isMutating}
                      />
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
                <ActionButton variant="white" size="sm" label="취소" onClick={cancelMoveMode} disabled={isMutating} />
                <ActionButton variant="black" size="sm" label="저장" onClick={handleMoveSaveClick} disabled={isMutating} />
              </>
            ) : (
              <ActionButton variant="outline" size="sm" label="수정" onClick={handleMoveClick} disabled={isMutating} />
            )}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {pcColumns.map((col) => <th key={col.key}>{col.label}</th>)}
                  <th className={styles.colAction}>반납</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={pcColumns.length + 1} className={styles.empty}>불러오는 중...</td></tr>
                ) : pcRows.length === 0 ? (
                  <tr><td colSpan={pcColumns.length + 1} className={styles.empty}>보유한 PC 자산이 없습니다.</td></tr>
                ) : pcRows.map((row) => (
                  <tr key={row.id}>
                    {pcColumns.map((col) => <td key={col.key}>{renderCell(col, row)}</td>)}
                    <td className={styles.colAction}>
                      <ActionButton
                        variant="red" size="xxs" label="반납"
                        onClick={() => handleReturnClick('pc', row.rawId)}
                        disabled={isMutating}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* 모달 */}
      <ConfirmModal
        isOpen={showReturnConfirm}
        title="자산을 반납할까요?"
        desc="반납된 자산은 목록에서 제외됩니다."
        confirmLabel="반납"
        confirmVariant="danger"
        onConfirm={handleReturnConfirm}
        onCancel={closeReturn}
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
  )
}

export default UserMyAssetsPage