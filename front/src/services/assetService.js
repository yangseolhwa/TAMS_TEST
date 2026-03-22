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
