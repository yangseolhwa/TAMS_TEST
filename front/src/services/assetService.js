/**
 * assetService.js
 * 자산 관련 API 통신 담당
 */

import api from './httpClient'
import { ENDPOINTS } from './endpoints'

const CATEGORY_NAME_MAP = {
  furniture:  '가구',
  office:     '사무',
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

// 카테고리 순서를 Map으로 캐싱 — sort 내부에서 반복 계산 방지
const categoryOrderMap = new Map(
  Object.keys(CATEGORY_NAME_MAP).map((key, i) => [key, i])
)

const downloadBlob = (data, filename) => {
  const url  = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href  = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

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
      acquisition_date: sw.acquisition_date      ?? null,
      license_key:      license.license_key    ?? null,
      license_password: license.license_password ?? null,
      related_link:     sw.related_link    ?? null,
      remarks:          sw.remarks         ?? null,
      state:            license.state,
    }))
  )

  return { pcRows, swRows }
}

// ─────────────────────────────────────────────────────────────────
// 콤보박스 조회 API — Enterprise 등록용
// ─────────────────────────────────────────────────────────────────
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
    const body = rejectReason?.trim() ? { rejection_reason: rejectReason.trim() } : {}
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
    const body = rejectReason?.trim() ? { rejection_reason: rejectReason.trim() } : {}
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.SW_REJECT}/${requestId}`, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 요청 반려에 실패했습니다.')
  }
}


// ─────────────────────────────────────────────────────────────────
// 요청 목록 조회 
// ─────────────────────────────────────────────────────────────────
export const fetchAssetRequests = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.REQUESTS)

  const enterpriseRows = (data.enterprise ?? []).map((item, i) => {
    let parsed = {}
    try { parsed = JSON.parse(item.new_asset_data ?? '{}') } catch (e) { console.error(e) }

    return {
      id:              `req-ent-${item.id}`,
      no:              i + 1,
      requestType:     item.request_type ?? null,
      requestedAt:     item.request_date ? item.request_date.slice(0, 10) : null,
      userName:        item.requester?.profile?.name ?? item.requester?.email ?? null,
      itemTypeName:    item.item_type?.name ?? item.asset?.item_type?.name ?? parsed.item_type_name ?? null,
      manufacturer:    item.asset?.manufacturer  ?? parsed.manufacturer  ?? null,
      serialNumber:    item.asset?.serial_number ?? parsed.serial_number ?? null,
      spec:            item.asset?.spec          ?? parsed.spec          ?? null,
      status:          item.status?.toUpperCase(),
      requestReason:   item.request_reason ?? null,
      rejectionReason: item.rejection_reason ?? null,
    }
  })

  const swRows = (data.sw ?? []).map((item, i) => {
    let parsed = {}
    try { parsed = JSON.parse(item.new_asset_data ?? '{}') } catch (e) { console.error(e) }

    return {
      id:              `req-sw-${item.id}`,
      no:              i + 1,
      requestType:     item.request_type ?? null,
      requestedAt:     item.request_date ? item.request_date.slice(0, 10) : null,
      userName:        item.requester?.profile?.name ?? item.requester?.email ?? null,
      assetName:       item.sw?.name          ?? parsed.name         ?? null,
      manufacturer:    item.sw?.manufacturer  ?? parsed.manufacturer ?? null,
      version:         item.sw?.version       ?? parsed.version      ?? null,
      licenseKey:      item.license_detail?.license_key ?? parsed.licenses?.[0]?.license_key ?? parsed.license_key ?? null,
      licensePassword: item.license_detail?.license_password ?? parsed.license_password ?? parsed.licenses?.[0]?.license_password ?? null,
      status:          item.status?.toUpperCase(),
      requestReason:   item.request_reason ?? null,
      rejectionReason: item.rejection_reason ?? null,
    }
  })

  return { enterpriseRows, swRows }
}

// ═══════════════════════════════════════════════════════════════
//  Admin 대시보드
// ═══════════════════════════════════════════════════════════════

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

export const fetchEnterpriseList = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.ENTERPRISE_LIST, { params: cleanParams })

    return {
      total: data.total ?? 0,
      rows: (data.list ?? [])
        .sort((a, b) => {
          // 1순위: CATEGORY_NAME_MAP 키 순서 (가구 > 사무 > 산업 > 전기)
          const catA = categoryOrderMap.get(a.item_number?.split('-')?.[0])
          const catB = categoryOrderMap.get(b.item_number?.split('-')?.[0])
          if (catA !== catB) return catA - catB

          // 2순위: item_type.code 알파벳 오름차순
          const codeA = a.item_type?.code ?? ''
          const codeB = b.item_type?.code ?? ''
          if (codeA !== codeB) return codeA.localeCompare(codeB)

          // 3순위: id 숫자 오름차순
          return a.id - b.id
        })
        .map((item, i) => ({
          id:             item.id,
          no:             i + 1,
          itemNumber:     convertItemNumber(item.item_number),
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
        })),

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

// ═══════════════════════════════════════════════════════════════
//  자산 할당 관련
// ═══════════════════════════════════════════════════════════════
 
// 전체 유저 목록 조회 (할당 대상 선택)
export const fetchUsers = async (keyword = '') => {
  try {
    const params = keyword.trim() ? { keyword: keyword.trim() } : {}
    const { data } = await api.get(ENDPOINTS.AUTH.USERS, { params })
    return data.users ?? []
  } catch (error) {
    throw new Error(error.response?.data?.message ?? '유저 목록 조회에 실패했습니다.')
  }
}
 
// PC 할당 가능 목록 조회 (state=stored & responsible_type=vacant)
export const fetchEnterpriseAvailable = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.ENTERPRISE_AVAILABLE, { params: cleanParams })
    return (data.list ?? [])
      .sort((a, b) => {
        const catA = categoryOrderMap.get(a.item_number?.split('-')?.[0])
        const catB = categoryOrderMap.get(b.item_number?.split('-')?.[0])
        if (catA !== catB) return catA - catB
      
        const codeA = a.item_type?.code ?? ''
        const codeB = b.item_type?.code ?? ''
        if (codeA !== codeB) return codeA.localeCompare(codeB)
        return a.id - b.id
      })
    .map((item) => ({
      ...item,
      item_number: convertItemNumber(item.item_number),
    }))
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 할당 가능 목록 조회에 실패했습니다.')
  }
}
 
// SW 할당 가능 목록 조회 (available 라이선스가 있는 SW)
export const fetchSwAvailable = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.SW_AVAILABLE)
    return data.list ?? []
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 할당 가능 목록 조회에 실패했습니다.')
  }
}
 
// PC 자산 직접 할당
export const assignEnterpriseAsset = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_ASSIGN, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 할당에 실패했습니다.')
  }
}

// SW 할당 (라이선스형: { license_id, user_id } / 구독형: { asset_sw_id, user_id })
export const assignSwLicense = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_ASSIGN, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 할당에 실패했습니다.')
  }
}

// PC 할당 요청 (user)
export const requestEnterpriseAssign = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.ENTERPRISE_ASSIGN_REQUEST, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 할당 요청에 실패했습니다.')
  }
}

// SW 할당 요청 (user)
export const requestSwAssign = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.SW_ASSIGN_REQUEST, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 할당 요청에 실패했습니다.')
  }
}
 
// ═══════════════════════════════════════════════════════════════
//  히스토리
// ═══════════════════════════════════════════════════════════════

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
      request:  '요청',
      rejected: '반려',
    }

    const swRows = (data.sw ?? []).map((item) => ({
      id:          `sw-${item.id}`,
      no:          0,
      assetType:   'SW',
      requestedAt: item.created_at ? item.created_at.slice(0, 10) : null,
      createdAt:   item.created_at ?? null,
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
      createdAt:   item.created_at ?? null,
      changeType:  CHANGE_TYPE_LABEL[item.change_type] ?? item.change_type,
      beforeValue: item.before_value ?? null,
      afterValue:  item.after_value  ?? null,
      assetName:   item.asset?.item_type?.name ?? null,
      detail:      item.asset?.manufacturer    ?? null,
      user:        item.changedBy?.profile?.name ?? item.changedBy?.email ?? null,
    }))

    const combined = [...swRows, ...enterpriseRows]
      // .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((row, i) => ({ ...row, no: i + 1 }))

    return combined
  } catch (error) {
    throw new Error(error.response?.data?.message ?? '히스토리 조회에 실패했습니다.')
  }
}

// ═══════════════════════════════════════════════════════════════
//  DF 자산
// ═══════════════════════════════════════════════════════════════

export const fetchDfDashboard = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.DASHBOARD_DF)
    const raw = data.projects ?? []

    const projectOptions = raw.map((p) => ({ id: p.id, name: p.name, typeIds: (p.by_type ?? []).map((t) => t.type_id) }))

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
        end_project: proj.end_project ?? false,
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

// ─────────────────────────────────────────────────────────────────
// DF 자산 종류 계층 조회 (등록 폼용)
// ─────────────────────────────────────────────────────────────────
export const fetchDfItemTypes = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.DF_TYPES)
    return (data.types ?? []).filter((g) => g.children?.length > 0)
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 종류 조회에 실패했습니다.')
  }
}

// ─────────────────────────────────────────────────────────────────
// DF 자산 조회
// rows 필드:
//   parentCategoryName — 대분류 ('PC' | 'PLC' | null)  ← PC/PLC 분기용
//   subCategoryName    — 중분류 ('CPU' | 'RACK' | ...)  ← null이면 대분류 직접 item
//   quantity, productName 추가
// ─────────────────────────────────────────────────────────────────
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
        const itemType    = item.item_type
        const isTopLevel  = itemType?.parent_id == null

        // parentCategoryName 추출:
        //   - isTopLevel: 대분류(PC/PLC) 자체 → parentCategoryName = 자기 이름
        //   - child:      중분류(CPU 등)      → parentCategoryName = parent.name (null이면 컴포넌트의 typeInfoMap이 보정)
        let parentCategoryName, subCategoryName
        if (!itemType) {
          parentCategoryName = null
          subCategoryName    = null
        } else if (isTopLevel) {
          parentCategoryName = itemType.name ?? null
          subCategoryName    = null
        } else {
          subCategoryName    = itemType.name ?? null
          parentCategoryName = itemType.parent?.name ?? null  // null이면 typeInfoMap으로 보정
        }

        rows.push({
          id:                  item.id,
          projectId:           proj.id,
          projectName:         proj.name,
          parentCategoryName,  // 'PC' | 'PLC' | null — 분기 기준
          subCategoryName,     // 중분류명 — 컬럼 표시용
          ownerOrg:            item.owner_organization ?? null,
          equipmentNo:         item.equipment_number   ?? null,
          itemTypeId:          item.item_type?.id      ?? null,
          productName:         item.product_name       ?? null,
          modelName:           item.model_number       ?? null,
          spec:                item.spec               ?? null,
          manufacturer:        item.manufacturer       ?? null,
          serialNumber:        item.serial_number      ?? null,
          quantity:            item.quantity           ?? null,
          acquiredAt:          item.acquisition_date ? item.acquisition_date.slice(0, 10) : null,
          returnedAt:          item.return_date      ? item.return_date.slice(0, 10)      : null,
          location:            item.location ?? null,
          state:               item.state    ?? null,
          remarks:             item.remarks  ?? null,
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

  downloadBlob(response.data, filename)
}

export const downloadDfTemplate = async () => {
  try {
    const response = await api.get(ENDPOINTS.ASSETS.DF_TEMPLATE, { responseType: 'blob' })
    const disposition = response.headers['content-disposition'] ?? ''
    const match       = disposition.match(/filename="(.+)"/)
    const filename    = match ? match[1] : 'TAMS_DF_양식.xlsx'

    downloadBlob(response.data, filename)
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
        projectName:  item.project?.name              ?? null,
        projectId:    item.project?.id                ?? null,
        category:     item.item?.item_type?.name      ?? null,
        modelName:    item.item?.model_number         ?? null,
        serialNumber: item.item?.serial_number        ?? null,
      }
    })
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 히스토리 조회에 실패했습니다.')
  }
}
