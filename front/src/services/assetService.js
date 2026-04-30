/**
 * assetService.js
 * 자산 관련 API 통신 담당
 */

import api from './httpClient'
import { ENDPOINTS } from './endpoints'

// ═══════════════════════════════════════════════════════════════
//  개인 자산
// ═══════════════════════════════════════════════════════════════

export const fetchEnterpriseCategories = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: 'enterprise' } })
  const seen = new Set()
  return (data.enterprise ?? []).reduce((acc, item) => {
    const cat = item.item_category
    if (cat && !seen.has(cat.id)) {
      seen.add(cat.id)
      acc.push({ id: cat.id, name: cat.name })
    }
    return acc
  }, [])
}

export const fetchPersonalAssets = async (params = {}) => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params })
  const enterpriseRows = (data.enterprise ?? []).map((item) => ({
    id:                 `ent-${item.id}`,
    rawId:              item.id,
    asset_type_label:   'PC',
    item_category_name: item.item_category?.name,
    asset_name:         item.model_name,
    manufacturer:       item.manufacturer,
    spec:               item.spec,
    serial_number:      item.serial_number,
    license_key:        '-',
    acquisition_date:   item.acquisition_date,
    return_date:        item.return_date,
    location:           item.location,
    state:              item.state,
  }))
  const swRows = (data.sw ?? []).flatMap((sw) =>
    (sw.licenses ?? []).map((license) => ({
      id:                 `sw-${sw.id}-${license.id}`,
      rawId:              license.id,
      swId:               sw.id,
      asset_type_label:   'SW',
      item_category_name: sw.software_type,
      asset_name:         sw.name,
      manufacturer:       sw.manufacturer,
      spec:               '-',
      serial_number:      '-',
      license_key:        license.license_key,
      acquisition_date:   '-',
      return_date:        '-',
      location:           license.location,
      state:              license.state,
    }))
  )
  return [...enterpriseRows, ...swRows].map((row, i) => ({ ...row, no: i + 1 }))
}

/**
 * 개인 자산 조회 (UserMyAssetsPage 용 — 원본 구조 유지)
 * Response: { enterprise: [...], sw: [{ ..., licenses: [...] }] }
 */
export const fetchMyAssets = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL)

  const pcRows = (data.enterprise ?? []).map((item) => ({
    id:               `ent-${item.id}`,
    rawId:            item.id,
    asset_number:     item.asset_number     ?? null,
    department_id:    item.department_id    ?? null,
    acquisition_date: item.acquisition_date ?? null,
    item_type_name:   item.item_type?.name  ?? null,
    spec:             item.spec             ?? null,
    manufacturer:     item.manufacturer     ?? null,
    serial_number:    item.serial_number    ?? null,
    location:         item.location         ?? null,
    remarks:          item.remarks          ?? null,
    state:            item.state,
  }))

  const swRows = (data.sw ?? []).flatMap((sw) =>
    (sw.licenses ?? []).map((license) => ({
      id:               `sw-${sw.id}-lic-${license.id}`,
      rawId:            license.id,
      swId:             sw.id,
      asset_name:       sw.name            ?? null,
      version:          sw.version         ?? null,
      manufacturer:     sw.manufacturer    ?? null,
      license_key:      license.license_key    ?? null,
      license_password: license.license_password ?? null,
      related_link:     license.related_link    ?? null,
      remarks:          license.remarks         ?? null,
      state:            license.state,
    }))
  )

  return { pcRows, swRows }
}

// 콤보박스 조회 API — Enterprise 등록용
export const fetchEnterpriseAssetsForForm = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.ENTERPRISE_LIST_SIMPLE)
  return data.categories ?? []
}

// 콤보박스 조회 API — SW 등록용
export const fetchSwAssetsForForm = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.SW_LIST_SIMPLE)
  return data.list ?? []
}

export const returnEnterpriseAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_RETURN, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 반납에 실패했습니다.')
  }
}

export const returnSwAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_RETURN, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 자산 반납에 실패했습니다.')
  }
}

export const moveEnterpriseAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_MOVE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 이동에 실패했습니다.')
  }
}

export const moveSwAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_MOVE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 자산 이동에 실패했습니다.')
  }
}

export const requestEnterpriseAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.ENTERPRISE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 등록 요청에 실패했습니다.')
  }
}

export const requestSwAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.SW, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 자산 등록 요청에 실패했습니다.')
  }
}

export const approveEnterpriseRequest = async (requestId) => {
  try {
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.ENTERPRISE_APPROVE}/${requestId}`)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 요청 승인에 실패했습니다.')
  }
}

export const rejectEnterpriseRequest = async (requestId, rejectReason) => {
  try {
    const body = rejectReason?.trim() ? { reject_reason: rejectReason.trim() } : {}
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.ENTERPRISE_REJECT}/${requestId}`, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 요청 반려에 실패했습니다.')
  }
}

export const approveSwRequest = async (requestId) => {
  try {
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.SW_APPROVE}/${requestId}`)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 요청 승인에 실패했습니다.')
  }
}

export const rejectSwRequest = async (requestId, rejectReason) => {
  try {
    const body = rejectReason?.trim() ? { reject_reason: rejectReason.trim() } : {}
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.SW_REJECT}/${requestId}`, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 요청 반려에 실패했습니다.')
  }
}
export const fetchAssetRequests = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.REQUESTS)

  const enterpriseRows = (data.enterprise ?? [])
    .filter((item) => item.request_type === 'register')
    .map((item) => {
      let parsed = {}
      try { parsed = JSON.parse(item.new_asset_data ?? '{}') } catch (e) { }
      return {
        id:              `req-ent-${item.id}`,
        assetType:       'PC',
        itemTypeName:    item.item_type?.name ?? parsed.item_type_name ?? null,
        manufacturer:    parsed.manufacturer  ?? null,
        spec:            parsed.spec          ?? null,
        serialNumber:    parsed.serial_number ?? null,
        userName:        item.requester?.profile?.name ?? item.requester?.email ?? null,
        requestedAt:     item.request_date ? item.request_date.slice(0, 10) : null,
        status:          item.status?.toUpperCase(),
        rejectionReason: item.rejection_reason ?? null,
      }
    })

  const swRows = (data.sw ?? [])
    .filter((item) => item.request_type === 'register')
    .map((item) => {
      let parsed = {}
      try { parsed = JSON.parse(item.new_asset_data ?? '{}') } catch (e) { }
      return {
        id:              `req-sw-${item.id}`,
        assetType:       'SW',
        assetName:       parsed.name         ?? item.sw?.name         ?? null,
        manufacturer:    parsed.manufacturer ?? item.sw?.manufacturer ?? null,
        version:         parsed.version      ?? item.sw?.version      ?? null,
        licenseKey:      parsed.license_key      ?? null,
        licensePassword: parsed.license_password ?? null,
        userName:        item.requester?.profile?.name ?? item.requester?.email ?? null,
        requestedAt:     item.request_date ? item.request_date.slice(0, 10) : null,
        status:          item.status?.toUpperCase(),
        rejectionReason: item.rejection_reason ?? null,
      }
    })

  return {
    enterpriseRows: enterpriseRows.map((row, i) => ({ ...row, no: i + 1 })),
    swRows:         swRows.map((row, i) => ({ ...row, no: i + 1 })),
  }
}

// ═══════════════════════════════════════════════════════════════
//  Admin 대시보드
// ═══════════════════════════════════════════════════════════════

/**
 * SW + PC 집계 대시보드 (admin 전용)
 * Response: {
 *   sw: {
 *     total_sw_count, total_license_count, total_in_use,
 *     list: [{ id, name, quantity, in_use_count, available_count,
 *              licenses: [{ id, license_key, state, user: { id, email, name } }] }]
 *   },
 *   enterprise: {
 *     total_count,
 *     by_item_type: [{ id, code, name, count }]
 *   }
 * }
 */
export const fetchDashboard = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.DASHBOARD)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? '대시보드 조회에 실패했습니다.')
  }
}

// ═══════════════════════════════════════════════════════════════
//  Admin — PC 전체 조회
// ═══════════════════════════════════════════════════════════════

/**
 * PC(Enterprise) 전체 조회 (admin 전용)
 * Response: { total, list: [{ id, item_category, item_type, User, ... }] }
 */
export const fetchEnterpriseList = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.ENTERPRISE_LIST, { params: cleanParams })

    // 카테고리명 영어 → 한글 매핑
const CATEGORY_NAME_MAP = {
  office:     '사무',
  furniture:  '가구',
  industrial: '산업',
  electrical: '전기',
}

// item_number의 카테고리 부분만 한글로 변환 (예: office-A-1 → 사무-A-1)
const convertItemNumber = (itemNumber) => {
  if (!itemNumber) return null
  const parts = itemNumber.split('-')
  const korName = CATEGORY_NAME_MAP[parts[0]]
  if (!korName) return itemNumber
  parts[0] = korName
  return parts.join('-')
}

return {
  total: data.total ?? 0,
  rows: (data.list ?? []).map((item, i) => {
  // item_number 형식: "office-A-1" → 카테고리 부분만 한글로 변환
  const CATEGORY_MAP = {
    office:      '사무',
    furniture:   '가구',
    industrial:  '산업',
    electrical:  '전기',
  }
  const itemNumber = (() => {
    if (!item.item_number) return null
    const parts = item.item_number.split('-')
    parts[0] = CATEGORY_MAP[parts[0]] ?? parts[0]
    return parts.join('-')
  })()

  return {
    id:             item.id,
    no:             i + 1,
    itemNumber,
    itemTypeName:   item.item_type?.name     ?? null,
    manufacturer:   item.manufacturer        ?? null,
    spec:           item.spec                ?? null,
    serialNumber:   item.serial_number       ?? null,
    location:       item.location            ?? null,
    acquiredAt:     item.acquisition_date    ?? null,
    state:          item.state,
    userName:       item.User?.profile?.name ?? item.User?.email ?? null,
    departmentName: item.User?.profile?.department?.name ?? null,
    remarks:        item.remarks ?? null,
  }
}),
      // 필터용 메타 (중복 제거)
      categories: (() => {
        const map = new Map()
        ;(data.list ?? []).forEach((item) => {
          const cat = item.item_category
          if (cat && !map.has(cat.id)) map.set(cat.id, { id: cat.id, name: cat.name })
        })
        return [...map.values()]
      })(),
      itemTypes: (() => {
        const map = new Map()
        ;(data.list ?? []).forEach((item) => {
          const t = item.item_type
          if (t && !map.has(t.id)) map.set(t.id, { id: t.id, name: t.name })
        })
        return [...map.values()]
      })(),
    }
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 목록 조회에 실패했습니다.')
  }
}

/**
 * PC 상태 변경 (admin/user)
 * @param {{ asset_ids: number[], state: 'in_use'|'stored' }} body
 */
export const changeEnterpriseState = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_STATE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 상태 변경에 실패했습니다.')
  }
}

// ═══════════════════════════════════════════════════════════════
//  Admin — SW 전체 조회
// ═══════════════════════════════════════════════════════════════

/**
 * SW 전체 조회 (admin 전용)
 * Response: { total, list: [{ id, name, version, manufacturer, quantity,
 *              in_use_count, available_count, licenses: [...] }] }
 */
export const fetchSwList = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.SW_LIST, { params: cleanParams })

    return {
      total: data.total ?? 0,
      list: (data.list ?? []).map((sw) => ({
        ...sw,
        related_link: sw.related_link ?? null,
        remarks:      sw.remarks      ?? null,
      })),
    }
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 목록 조회에 실패했습니다.')
  }
}

/**
 * SW 라이선스 할당 (admin 전용)
 * @param {{ license_id: number, user_id: number }} body
 */
export const assignSwLicense = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_ASSIGN, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 라이선스 할당에 실패했습니다.')
  }
}

// ═══════════════════════════════════════════════════════════════
//  히스토리
// ═══════════════════════════════════════════════════════════════

/**
 * 개인 자산 히스토리 조회 (SW + PC)
 * Response: {
 *   sw: [{ id, asset_sw_id, change_type, before_value, after_value, created_at,
 *          sw: { id, name, version, manufacturer },
 *          license: { id, license_key, key_type },
 *          changedBy: { id, email, profile: { name } } }],
 *   enterprise: [{ id, asset_enterprise_id, change_type, before_value, after_value, created_at,
 *                  asset: { id, manufacturer, state, item_type: { id, name } },
 *                  changedBy: { ... } }]
 * }
 */
export const fetchPersonalHistory = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.HISTORY_PERSONAL, { params: cleanParams })

    const CHANGE_TYPE_LABEL = {
      register: '등록',
      returned: '반납',
      change:   '상태 변경',
      move:     '이동',
      assign:   '할당',
    }

    const swRows = (data.sw ?? []).map((item) => ({
      id:          `sw-${item.id}`,
      no:          0,
      assetType:   'SW',
      requestedAt: item.created_at ? item.created_at.slice(0, 10) : null,
      changeType:  CHANGE_TYPE_LABEL[item.change_type] ?? item.change_type,
      beforeValue: item.before_value ?? null,
      afterValue:  item.after_value  ?? null,
      assetName:   item.sw?.name     ?? null,
      detail:      item.license?.license_key ?? null,
      user:        item.changedBy?.profile?.name ?? item.changedBy?.email ?? null,
    }))

    const enterpriseRows = (data.enterprise ?? []).map((item) => ({
      id:          `ent-${item.id}`,
      no:          0,
      assetType:   'PC',
      requestedAt: item.created_at ? item.created_at.slice(0, 10) : null,
      changeType:  CHANGE_TYPE_LABEL[item.change_type] ?? item.change_type,
      beforeValue: item.before_value ?? null,
      afterValue:  item.after_value  ?? null,
      assetName:   item.asset?.item_type?.name ?? null,
      detail:      item.asset?.manufacturer    ?? null,
      user:        item.changedBy?.profile?.name ?? item.changedBy?.email ?? null,
    }))

    // 날짜 내림차순 병합
    const combined = [...swRows, ...enterpriseRows]
      .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''))
      .map((row, i) => ({ ...row, no: i + 1 }))

    return combined
  } catch (error) {
    throw new Error(error.response?.data?.message ?? '히스토리 조회에 실패했습니다.')
  }
}

// ═══════════════════════════════════════════════════════════════
//  DF 자산
// ═══════════════════════════════════════════════════════════════

/**
 * DF 대시보드 조회
 * Response: { total, projects: [{ id, name, total_count, by_type: [{ type_id, type_name, count }] }] }
 */
export const fetchDfDashboard = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.DASHBOARD_DF)
    const raw = data.projects ?? []

    const projectOptions = raw.map((p) => ({ id: p.id, name: p.name }))

    const typeMap = new Map()
    raw.forEach((proj) => {
      ;(proj.by_type ?? []).forEach((t) => {
        if (!typeMap.has(t.type_id)) {
          typeMap.set(t.type_id, { id: t.type_id, name: t.type_name })
        }
      })
    })

    const projects = raw
      .map((proj) => ({
        id:    proj.id,
        name:  proj.name,
        total: proj.total_count ?? 0,
        items: (proj.by_type ?? []).map((t) => ({
          itemType: t.type_name,
          quantity: t.count ?? 0,
        })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

    return { projects, projectOptions, typeOptions: [...typeMap.values()] }
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 대시보드 조회에 실패했습니다.')
  }
}

/**
 * DF 자산 조회
 * Response: { projects: [{ id, name, items: [{ id, item_type: { id, name, parent_id }, ... }] }] }
 */
export const fetchDfAssets = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.DF, { params: cleanParams })
    const projects = data.projects ?? []

    const projectSummaries = projects.map((proj) => ({
      id:    proj.id,
      name:  proj.name,
      count: proj.items?.length ?? 0,
    }))

    const rows = []
    projects.forEach((proj) => {
      ;(proj.items ?? []).forEach((item) => {
        const isTopLevel = item.item_type?.parent_id == null
        rows.push({
          id:            item.id,
          projectId:     proj.id,
          projectName:   proj.name,
          ownerOrg:      item.owner_organization ?? null,
          equipmentNo:   item.equipment_number   ?? null,
          majorCategory: isTopLevel ? (item.item_type?.name ?? null) : null,
          minorCategory: isTopLevel ? null : (item.item_type?.name ?? null),
          itemTypeId:    item.item_type?.id   ?? null,
          modelName:     item.model_name      ?? null,
          spec:          item.spec            ?? null,
          manufacturer:  item.manufacturer    ?? null,
          serialNumber:  item.serial_number   ?? null,
          acquiredAt:    item.acquisition_date ? item.acquisition_date.slice(0, 10) : null,
          returnedAt:    item.return_date      ? item.return_date.slice(0, 10)      : null,
          location:      item.location ?? null,
          state:         item.state    ?? null,
          remarks:       item.remarks  ?? null,
        })
      })
    })

    return {
      rows: rows.map((row, i) => ({ ...row, no: i + 1 })),
      projectSummaries,
    }
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 조회에 실패했습니다.')
  }
}

export const registerDfAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.DF, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 등록에 실패했습니다.')
  }
}

export const changeDfAssetState = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_STATE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 상태 변경에 실패했습니다.')
  }
}

export const moveDfAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_MOVE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 이동에 실패했습니다.')
  }
}

export const returnDfAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_RETURN, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 반납에 실패했습니다.')
  }
}

export const importDfAssets = async (file) => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post(ENDPOINTS.ASSETS.DF_IMPORT, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? '업로드에 실패했습니다.')
  }
}

export const exportDfAssets = async (params = {}) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  )
  const response = await api.get(ENDPOINTS.ASSETS.DF_EXPORT, {
    params: cleanParams,
    responseType: 'blob',
  })
  const disposition = response.headers['content-disposition'] ?? ''
  const match       = disposition.match(/filename="(.+)"/)
  const filename    = match
    ? match[1]
    : `TAMS_DF_DOWNLOAD_${new Date().toISOString().slice(0, 10)}.xlsx`

  const url  = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href  = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const downloadDfTemplate = async () => {
  try {
    const response = await api.get(ENDPOINTS.ASSETS.DF_TEMPLATE, { responseType: 'blob' })
    const disposition = response.headers['content-disposition'] ?? ''
    const match       = disposition.match(/filename="(.+)"/)
    const filename    = match ? match[1] : 'TAMS_DF_양식.xlsx'

    const url  = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href  = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    throw new Error(error.response?.data?.message ?? '양식 다운로드에 실패했습니다.')
  }
}

export const fetchDfHistory = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.HISTORY_DF, { params: cleanParams })

    const CHANGE_TYPE_LABEL = { register: '등록', returned: '반납', move: '이동', change: '상태 변경' }
    const STATE_LABEL = { in_use: '사용중', stored: '보관중', rented: '대여중', returned: '반납됨' }

    return (data.list ?? []).map((item, i) => {
      const changeType = item.change_type
      let prevLocation = null, nextLocation = null
      let prevState    = null, nextState    = null

      if (changeType === 'move') {
        prevLocation = item.before_value ?? null
        nextLocation = item.after_value  ?? null
      } else if (changeType === 'change') {
        prevState = STATE_LABEL[item.before_value] ?? item.before_value ?? null
        nextState = STATE_LABEL[item.after_value]  ?? item.after_value  ?? null
      }

      return {
        id:           item.id,
        no:           i + 1,
        requestedAt:  item.created_at ? item.created_at.slice(0, 10) : null,
        user:         item.changedBy?.profile?.name ?? item.changedBy?.email ?? null,
        requestType:  CHANGE_TYPE_LABEL[changeType] ?? changeType,
        prevLocation,
        nextLocation,
        prevState,
        nextState,
        projectName:  item.project?.name         ?? null,
        projectId:    item.project?.id           ?? null,
        category:     item.item?.item_type?.name ?? null,
        modelName:    item.item?.model_name      ?? null,
        serialNumber: item.item?.serial_number   ?? null,
      }
    })
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 히스토리 조회에 실패했습니다.')
  }
}
