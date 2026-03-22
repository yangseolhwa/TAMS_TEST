/**
 * assetService.js
 * 자산 관련 API 통신 담당
 */

import api from './httpClient'
import { ENDPOINTS } from './endpoints'

/**
 * 개인 자산 조회 (enterprise + sw 통합)
 * @param {object} params - 쿼리 파라미터
 * @returns {Promise<object[]>}
 */
export const fetchPersonalAssets = async (params = {}) => {
  try {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    )
    const { data } = await api.get(ENDPOINTS.ASSETS.PERSONAL, { params: cleanParams })

    const enterpriseRows = (data.enterprise ?? []).map((item) => ({
      ...item,
      id:         `ent-${item.id}`,
      original_id: item.id,
      _type:      'PC',
      _category:  item.enterprise_category?.name ?? null,
      _assetName: item.model_name ?? null,
      _status:    item.state ?? null,
    }))

    const swRows = (data.sw ?? []).map((item) => ({
      ...item,
      id:         `sw-${item.id}`,
      original_id: item.id,
      _type:      'SW',
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