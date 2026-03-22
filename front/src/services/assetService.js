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
      id: `ent-${item.id}`,     
      original_id: item.id,      
      _type:      "PC",
      _category:  item.enterprise_category?.name ?? null,
      _assetName: item.model_name ?? null,
      _status:    item.state ?? null,
    }))

    const swRows = (data.sw ?? []).map((item) => ({
      ...item,                     
      id: `sw-${item.id}`,         
      original_id: item.id,
      _type:      "SW",
      _category:  item.software_type ?? null,
      _assetName: item.name ?? null,
      _status:    item.state ?? null,
    }))

    
    // 두 배열을 합친 후 전체 번호(no)를 1번부터 순차적으로 부여
    return [...enterpriseRows, ...swRows].map((row, i) => ({ ...row, no: i + 1 }))
  } catch (error) {
    const message = error.response?.data?.message ?? '자산 조회에 실패했습니다.'
    throw new Error(message)
  }
}