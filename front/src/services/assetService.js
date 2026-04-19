/**
 * assetService.js
 * 자산 관련 API 통신 담당
 */

import api from './httpClient'
import { ENDPOINTS } from './endpoints'

export const fetchEnterpriseCategories = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "enterprise" } });
  const seen = new Set();
  return (data.enterprise ?? []).reduce((acc, item) => {
    const cat = item.item_category;
    if (cat && !seen.has(cat.id)) {
      seen.add(cat.id);
      acc.push({ id: cat.id, name: cat.name });
    }
    return acc;
  }, []);
};

export const fetchPersonalAssets = async (params = {}) => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params });
  const enterpriseRows = (data.enterprise ?? []).map((item) => ({
    id: `ent-${item.id}`,
    asset_type_label: "PC",
    item_category_name: item.item_category?.name,
    asset_name: item.model_name,
    manufacturer: item.manufacturer,
    spec: item.spec,
    serial_number: item.serial_number,
    license_key: "-",
    acquisition_date: item.acquisition_date,
    return_date: item.return_date,
    subscription_date: "-",
    location: item.location,
    state: item.state,
  }));
  const swRows = (data.sw ?? []).flatMap((sw) =>
    (sw.licenses ?? []).map((license) => ({
      id: `sw-${sw.id}-${license.id}`,
      asset_type_label: "SW",
      item_category_name: sw.software_type,
      asset_name: sw.name,
      manufacturer: sw.manufacturer,
      spec: "-",
      serial_number: "-",
      license_key: license.license_key,
      acquisition_date: "-",
      return_date: "-",
      subscription_date: license.subscription_date,
      location: license.location,
      state: license.state,
    }))
  );
  return [...enterpriseRows, ...swRows].map((row, i) => ({ ...row, no: i + 1 }));
};

export const fetchEnterpriseAssetsForForm = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "enterprise" } });
  return data.enterprise ?? [];
};

export const fetchSwAssetsForForm = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "sw" } });
  return data.sw ?? [];
};

export const returnEnterpriseAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_RETURN, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 반납에 실패했습니다.');
  }
};

export const returnSwAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_RETURN, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 자산 반납에 실패했습니다.');
  }
};

export const moveEnterpriseAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_MOVE, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 이동에 실패했습니다.');
  }
};

export const moveSwAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_MOVE, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 자산 이동에 실패했습니다.');
  }
};

export const requestEnterpriseAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.ENTERPRISE, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 자산 등록 요청에 실패했습니다.');
  }
};

export const requestSwAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.SW, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 자산 등록 요청에 실패했습니다.');
  }
};

export const approveEnterpriseRequest = async (requestId) => {
  try {
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.ENTERPRISE_APPROVE}/${requestId}`);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 요청 승인에 실패했습니다.');
  }
};

export const rejectEnterpriseRequest = async (requestId, rejectReason) => {
  try {
    const body = rejectReason?.trim() ? { reject_reason: rejectReason.trim() } : {};
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.ENTERPRISE_REJECT}/${requestId}`, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'PC 요청 반려에 실패했습니다.');
  }
};

export const approveSwRequest = async (requestId) => {
  try {
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.SW_APPROVE}/${requestId}`);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 요청 승인에 실패했습니다.');
  }
};

export const rejectSwRequest = async (requestId, rejectReason) => {
  try {
    const body = rejectReason?.trim() ? { reject_reason: rejectReason.trim() } : {};
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.SW_REJECT}/${requestId}`, body);
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'SW 요청 반려에 실패했습니다.');
  }
};

const REQUEST_TYPE_LABEL = { register: "등록 요청", return: "반납 요청" };

export const fetchAssetRequests = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.REQUESTS);
  const enterpriseRows = (data.enterprise ?? []).map((item) => {
    let parsed = {};
    try { parsed = JSON.parse(item.new_asset_data ?? "{}"); } catch (e) { /* noop */ }
    return {
      id:          `req-ent-${item.id}`,
      assetType:   "PC",
      assetName:   parsed.model_name ?? null,
      spec:        parsed.spec       ?? null,
      requestType: REQUEST_TYPE_LABEL[item.request_type] ?? item.request_type,
      requester:   item.requester?.email ?? null,
      requestedAt: item.request_date ? item.request_date.slice(0, 10) : null,
      processedAt: item.processed_at ? item.processed_at.slice(0, 10) : null,
      status:      item.status?.toUpperCase(),
      reason:      item.admin_reason ?? null,
    };
  });
  const swRows = (data.sw ?? []).map((item) => {
    let parsed = {};
    try { parsed = JSON.parse(item.new_asset_data ?? "{}"); } catch (e) { /* noop */ }
    return {
      id:          `req-sw-${item.id}`,
      assetType:   "SW",
      assetName:   parsed.name ?? item.sw?.name ?? null,
      spec:        null,
      requestType: REQUEST_TYPE_LABEL[item.request_type] ?? item.request_type,
      requester:   item.requester?.email ?? null,
      requestedAt: item.request_date ? item.request_date.slice(0, 10) : null,
      processedAt: item.processed_at ? item.processed_at.slice(0, 10) : null,
      status:      item.status?.toUpperCase(),
      reason:      item.admin_reason ?? null,
    };
  });
  return [...enterpriseRows, ...swRows].map((row, i) => ({ ...row, no: i + 1 }));
};

// ═══════════════════════════════════════════════════════════════
//  DF 자산
// ═══════════════════════════════════════════════════════════════

/**
 * DF 대시보드 조회
 * Response: {
 *   total: number,
 *   projects: [{ id, name, total_count, by_type: [{ type_id, type_name, count }] }]
 * }
 */
export const fetchDfDashboard = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.DASHBOARD_DF)
    const raw = data.projects ?? []

    // 프로젝트 옵션 (select용)
    const projectOptions = raw.map((p) => ({ id: p.id, name: p.name }))

    // 자산 종류 flat 목록 (parent 정보 미제공 → flat list)
    const typeMap = new Map()
    raw.forEach((proj) => {
      ;(proj.by_type ?? []).forEach((t) => {
        if (!typeMap.has(t.type_id)) {
          typeMap.set(t.type_id, { id: t.type_id, name: t.type_name })
        }
      })
    })

    // 대시보드 카드용 데이터
    const projects = raw.map((proj) => ({
      id:    proj.id,
      name:  proj.name,
      total: proj.total_count ?? 0,
      items: (proj.by_type ?? []).map((t) => ({
        itemType: t.type_name,
        quantity: t.count ?? 0,
      })),
    }))

    return {
      projects,
      projectOptions,
      typeOptions: [...typeMap.values()],
    }
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 대시보드 조회에 실패했습니다.')
  }
}

/**
 * DF 자산 조회
 * Response: { projects: [{ id, name, items: [{ id, item_type: { id, name, parent_id }, ... }] }] }
 *
 * item_type.parent_id === null  → 대분류
 * item_type.parent_id !== null  → 중분류 (부모명은 API에서 미제공)
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

/**
 * DF 자산 등록
 * @param {{ project_id: number, items: object[] }} body
 */
export const registerDfAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.DF, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 등록에 실패했습니다.')
  }
}

/**
 * DF 자산 상태 변경
 * @param {{ item_ids: number[], state: 'in_use'|'stored'|'rented' }} body
 */
export const changeDfAssetState = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_STATE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 상태 변경에 실패했습니다.')
  }
}

/**
 * DF 자산 이동
 * @param {{ item_ids: number[], location: string }} body
 */
export const moveDfAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_MOVE, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 이동에 실패했습니다.')
  }
}

/**
 * DF 자산 반납
 * @param {{ item_ids: number[] }} body
 */
export const returnDfAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_RETURN, body)
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message ?? 'DF 자산 반납에 실패했습니다.')
  }
}

/**
 * DF 자산 엑셀 업로드
 */
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

/**
 * DF 자산 엑셀 다운로드
 */
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

/**
 * DF Import 양식 다운로드
 */
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

/**
 * DF 히스토리 조회
 * Response: {
 *   total: number,
 *   list: [{ id, change_type, before_value, after_value, created_at,
 *            item: { id, model_name, serial_number, item_type: { id, name } },
 *            project: { id, name },
 *            changedBy: { id, email, profile: { name } } }]
 * }
 */
export const fetchDfHistory = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.HISTORY_DF, { params: cleanParams })

    const CHANGE_TYPE_LABEL = {
      register: '등록',
      returned: '반납',
      move:     '이동',
      change:   '상태 변경',
    }
    const STATE_LABEL = {
      in_use:   '사용중',
      stored:   '보관중',
      rented:   '대여중',
      returned: '반납됨',
    }

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