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

    return [...enterpriseRows, ...swRows].map((row, i) => ({ ...row, no: i + 1 }))
  } catch (error) {
    const message = error.response?.data?.message ?? '자산 조회에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * DF 자산 조회
 * 응답 구조: { projects: [{ id, name, items: [...] }] }
 *
 * @param {object} params - 쿼리 파라미터 (project_id, item_type_id, manufacturer, state, keyword)
 * @returns {Promise<{ rows: object[], projectSummaries: object[] }>}
 * @throws {Error} 조회 실패 시
 */
export const fetchDfAssets = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )

    const { data } = await api.get(ENDPOINTS.ASSETS.DF, { params: cleanParams })

    // 백엔드 응답: { projects: [ { id, name, items: [...] } ] }
    const projects = data.projects ?? []

    // 프로젝트 요약 (카드용)
    const projectSummaries = projects.map((proj) => ({
      id:    proj.id,
      name:  proj.name,
      count: proj.items?.length ?? 0,
    }))

    // 프로젝트 별 items를 평탄화(flatten)하여 테이블 row 생성
    const rows = []
    projects.forEach((proj) => {
      ;(proj.items ?? []).forEach((item) => {
        rows.push({
          id:              item.id,
          projectId:       proj.id,
          project:         proj.name,
          doosanItemNumber: item.doosan_item_number ?? null,
          itemType:        item.item_type?.name ?? null,
          modelName:       item.model_name ?? null,
          manufacturer:    item.manufacturer ?? null,
          serialNumber:    item.serial_number ?? null,
          quantity:        item.quantity != null
            ? `${item.quantity} ${item.quantity_unit ?? 'ea'}`
            : null,
          rentalStartDate: item.rental_start_date
            ? item.rental_start_date.slice(0, 10)
            : null,
          rentalEndDate:   item.rental_end_date
            ? item.rental_end_date.slice(0, 10)
            : null,
          location:        item.location ?? null,
          state:           item.state ?? null,
          remarks:         item.remarks ?? null,
        })
      })
    })

    // No는 전체 flat 배열 기준으로 부여
    const numberedRows = rows.map((row, i) => ({ ...row, no: i + 1 }))

    return { rows: numberedRows, projectSummaries }
  } catch (error) {
    const message = error.response?.data?.message ?? 'DF 자산 조회에 실패했습니다.'
    throw new Error(message)
  }
}