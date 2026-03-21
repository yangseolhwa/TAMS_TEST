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
export const fetchPersonalAssets = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    )

    const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: cleanParams })

    const enterpriseRows = (data.enterprise ?? []).map((item) => ({
      ...item,
      _type:      "PC",
      _category:  item.enterprise_category?.name ?? null,
      _assetName: item.model_name ?? null,
      _status:    item.state ?? null,
    }))

    const swRows = (data.swLicense ?? []).map((item) => ({
      ...item,
      _type:      "SW",
      _category:  item.asset_sw?.software_type ?? null,
      _assetName: item.asset_sw?.name ?? null,
      _status:    item.asset_sw?.state ?? null,
    }))

    return [...enterpriseRows, ...swRows].map((row, i) => ({ ...row, no: i + 1 }))
  } catch (error) {
    const message = error.response?.data?.message ?? '자산 조회에 실패했습니다.'
    throw new Error(message)
  }
}