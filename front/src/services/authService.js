/**
 * authService.js
 * 인증 관련 API 통신 담당
 */

import api from './httpClient'
import { ENDPOINTS } from './endpoints'

/**
 * @param {string} email
 * @returns {Promise<{ role: string }>}
 * @throws {Error} 로그인 실패 시
 */
export const login = async (email) => {
  const { data } = await api.post(ENDPOINTS.AUTH.LOGIN, { email })
  return data
}