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
  try {
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
  } catch (error) {
    throw error;
  }
};

/**
 * 자산 등록 요청 폼용 Enterprise 자산 목록 (원본 데이터)
 */
export const fetchEnterpriseAssetsForForm = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "enterprise" } });
    return data.enterprise ?? [];
  } catch (error) {
    throw error;
  }
};

/**
 * 자산 등록 요청 폼용 SW 자산 목록 (원본 데이터)
 */
export const fetchSwAssetsForForm = async () => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: { type: "sw" } });
    return data.sw ?? [];
  } catch (error) {
    throw error;
  }
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
