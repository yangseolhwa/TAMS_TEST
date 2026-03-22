/**
 * assetService.js
 * 자산 관련 API 통신 담당
 */

import api from './httpClient'
import { ENDPOINTS } from './endpoints'

/**
 * 개인 자산 조회 (enterprise + sw 통합)
 * @param {object} params - 쿼리 파라미터
 * @returns {Promise<object[]>} DataTable row 배열
 * @throws {Error} 조회 실패 시
 */
import api from './httpClient'
import { ENDPOINTS } from './endpoints'

export const fetchPersonalAssets = async (params = {}) => {
  try {
    const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params });

    // 브라우저 콘솔(F12)에서 이 로그가 찍히는지, 데이터 구조가 어떤지 꼭 확인하세요.
    console.log("검색 결과 원본 데이터:", data);

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
    console.error("자산 로드 중 오류 발생:", error);
    throw error;
  }
};
