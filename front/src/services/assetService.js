/**
 * assetService.js
 * 자산 관련 API 통신 담당
 */

import api from './httpClient'
import { ENDPOINTS } from './endpoints'

export const fetchEnterpriseCategories = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "enterprise" } });

  // item_category 중복 제거 후 { id, name } 목록 반환
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

  const combined = [...enterpriseRows, ...swRows].map((row, index) => ({
    ...row,
    no: index + 1,
  }));

  console.log("변환된 데이터 (Table용):", combined);
  return combined;
};

/**
 * 자산 등록 요청 폼용 Enterprise 자산 목록 (원본 데이터)
 */
export const fetchEnterpriseAssetsForForm = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "enterprise" } });
  return data.enterprise ?? [];
};

/**
 * 자산 등록 요청 폼용 SW 자산 목록 (원본 데이터)
 */
export const fetchSwAssetsForForm = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "sw" } });
  return data.sw ?? [];
};

/**
 * Enterprise(PC) 자산 반납
 * @param {{ asset_ids: number[] }} body
 */
export const returnEnterpriseAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_RETURN, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'PC 자산 반납에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * SW 라이선스 반납
 * @param {{ license_ids: number[] }} body
 */
export const returnSwAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_RETURN, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'SW 자산 반납에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * Enterprise(PC) 자산 위치 이동
 * @param {{ asset_ids: number[], location: string }} body
 */
export const moveEnterpriseAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.ENTERPRISE_MOVE, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'PC 자산 이동에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * SW 라이선스 위치 이동
 * @param {{ license_ids: number[], location: string }} body
 */
export const moveSwAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.SW_MOVE, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'SW 자산 이동에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * Enterprise(PC) 자산 등록 요청
 * @param {{ is_existing: boolean, assets: object[] }} body
 */
export const requestEnterpriseAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.ENTERPRISE, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'PC 자산 등록 요청에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * SW 자산 등록 요청
 * @param {{ is_existing: boolean, licenses: object[] }} body
 */
export const requestSwAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.SW, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'SW 자산 등록 요청에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * Enterprise(PC) 등록 요청 승인
 * @param {number} requestId
 */
export const approveEnterpriseRequest = async (requestId) => {
  try {
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.ENTERPRISE_APPROVE}/${requestId}`);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'PC 요청 승인에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * Enterprise(PC) 등록 요청 반려
 * @param {number} requestId
 * @param {string} rejectReason
 */
export const rejectEnterpriseRequest = async (requestId, rejectReason) => {
  try {
    const body = rejectReason?.trim() ? { reject_reason: rejectReason.trim() } : {};
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.ENTERPRISE_REJECT}/${requestId}`, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'PC 요청 반려에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * SW 등록 요청 승인
 * @param {number} requestId
 */
export const approveSwRequest = async (requestId) => {
  try {
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.SW_APPROVE}/${requestId}`);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'SW 요청 승인에 실패했습니다.';
    throw new Error(message);
  }
};

/**
 * SW 등록 요청 반려
 * @param {number} requestId
 * @param {string} rejectReason
 */
export const rejectSwRequest = async (requestId, rejectReason) => {
  try {
    const body = rejectReason?.trim() ? { reject_reason: rejectReason.trim() } : {};
    const { data } = await api.patch(`${ENDPOINTS.ASSETS.SW_REJECT}/${requestId}`, body);
    return data;
  } catch (error) {
    const message = error.response?.data?.message ?? 'SW 요청 반려에 실패했습니다.';
    throw new Error(message);
  }
};

// request_type 한글 레이블
const REQUEST_TYPE_LABEL = {
  register: "등록 요청",
  return:   "반납 요청",
};

/**
 * 자산 요청 현황 목록 조회 (DataTable용 변환 포함)
 * enterprise / sw 배열을 하나의 행 배열로 합쳐서 반환
 */
export const fetchAssetRequests = async () => {
  const { data } = await api.get(ENDPOINTS.ASSETS.REQUESTS);

  const enterpriseRows = (data.enterprise ?? []).map((item) => {
    // new_asset_data가 JSON 문자열이므로 파싱하여 자산명/규격 추출
    let parsed = {};
    try { parsed = JSON.parse(item.new_asset_data ?? "{}"); } catch (e) { console.warn("enterprise new_asset_data 파싱 실패:", e); }

    return {
      id:          `req-ent-${item.id}`,
      assetType:   "PC",
      assetName:   parsed.model_name ?? null,
      spec:        parsed.spec       ?? null,
      requestType: REQUEST_TYPE_LABEL[item.request_type] ?? item.request_type,
      requester:   item.requester?.email ?? null,   // ← 추가
      requestedAt: item.request_date  ? item.request_date.slice(0, 10)  : null,
      processedAt: item.processed_at  ? item.processed_at.slice(0, 10)  : null,
      status:      item.status?.toUpperCase(),
      reason:      item.admin_reason  ?? null,
    };
  });

  const swRows = (data.sw ?? []).map((item) => {
    let parsed = {};
    try { parsed = JSON.parse(item.new_asset_data ?? "{}"); } catch (e) { console.warn("sw new_asset_data 파싱 실패:", e); }

    return {
      id:          `req-sw-${item.id}`,
      assetType:   "SW",
      assetName:   parsed.name ?? item.sw?.name ?? null,
      spec:        null,
      requestType: REQUEST_TYPE_LABEL[item.request_type] ?? item.request_type,
      requester:   item.requester?.email ?? null,   // ← 추가
      requestedAt: item.request_date  ? item.request_date.slice(0, 10)  : null,
      processedAt: item.processed_at  ? item.processed_at.slice(0, 10)  : null,
      status:      item.status?.toUpperCase(),
      reason:      item.admin_reason  ?? null,
    };
  });

  const combined = [...enterpriseRows, ...swRows].map((row, index) => ({
    ...row,
    no: index + 1,
  }));

  return combined;
};

/**
 * DF 자산 조회
 * 응답 구조: { projects: [{ id, name, items: [...] }] }
 * @param {object} params - 쿼리 파라미터 (project_id, item_type_id, manufacturer, state, keyword)
 * @returns {Promise<{ rows: object[], projectSummaries: object[] }>}
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
        rows.push({
          id:               item.id,
          projectId:        proj.id,
          project:          proj.name,
          doosanItemNumber: item.doosan_item_number ?? null,
          itemTypeId:       item.item_type?.id      ?? null,
          itemType:         item.item_type?.name     ?? null,
          modelName:        item.model_name          ?? null,
          manufacturer:     item.manufacturer        ?? null,
          serialNumber:     item.serial_number       ?? null,
          quantity:         item.quantity != null
            ? `${item.quantity} ${item.quantity_unit ?? 'ea'}`
            : null,
          rentalStartDate:  item.rental_start_date
            ? item.rental_start_date.slice(0, 10)
            : null,
          rentalEndDate:    item.rental_end_date
            ? item.rental_end_date.slice(0, 10)
            : null,
          location:         item.location ?? null,
          state:            item.state    ?? null,
          remarks:          item.remarks  ?? null,
        })
      })
    })

    return { rows: rows.map((row, i) => ({ ...row, no: i + 1 })), projectSummaries }
  } catch (error) {
    const message = error.response?.data?.message ?? 'DF 자산 조회에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * DF 자산 등록
 * @param {{ project_id: number, is_existing: boolean, items: object[] }} body
 * @returns {Promise<object>}
 */
export const registerDfAsset = async (body) => {
  try {
    const { data } = await api.post(ENDPOINTS.ASSETS.DF, body)
    return data
  } catch (error) {
    const message = error.response?.data?.message ?? 'DF 자산 등록에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * DF 자산 이동
 * @param {{ item_ids: number[], location: string }} body
 * @returns {Promise<object>}
 */
export const moveDfAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_MOVE, body)
    return data
  } catch (error) {
    const message = error.response?.data?.message ?? 'DF 자산 이동에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * DF 자산 반납
 * @param {{ item_ids: number[] }} body
 * @returns {Promise<object>}
 */
export const returnDfAssets = async (body) => {
  try {
    const { data } = await api.patch(ENDPOINTS.ASSETS.DF_RETURN, body)
    return data
  } catch (error) {
    const message = error.response?.data?.message ?? 'DF 자산 반납에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * DF 자산 엑셀 업로드
 * @param {File} file - .xlsx 파일
 * @returns {Promise<{ message: string, imported: number, failed: number, results: object[] }>}
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
    const message = error.response?.data?.message ?? 'Import에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * DF 자산 엑셀 다운로드 (현재 필터 적용)
 * @param {object} params - 쿼리 파라미터 (project_id, item_type_id, manufacturer, state, keyword)
 * @returns {Promise<void>} - 브라우저 파일 다운로드 트리거
 */
export const exportDfAssets = async (params = {}) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  )

  const response = await api.get(ENDPOINTS.ASSETS.DF_EXPORT, {
    params: cleanParams,
    responseType: 'blob',
  })

  // Content-Disposition 헤더에서 파일명 추출 (없으면 기본값)
  const disposition = response.headers['content-disposition'] ?? ''
  const match       = disposition.match(/filename="(.+)"/)
  const filename    = match
    ? match[1]
    : `TAMS_DF_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`

  const url  = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href  = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
