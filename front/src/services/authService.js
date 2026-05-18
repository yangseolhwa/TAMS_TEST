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
  try {
    const { data } = await api.post(ENDPOINTS.AUTH.LOGIN, { email })
    return data
  } catch (error) {
    const message = error.response?.data?.message ?? '로그인에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * @throws {Error} 로그아웃 실패 시
 */
export const logout = async () => {
  try {
    await api.post(ENDPOINTS.AUTH.LOGOUT)
  } catch (error) {
    const message = error.response?.data?.message ?? '로그아웃에 실패했습니다.'
    throw new Error(message)
  }
}

/**
 * admin ↔ user 계정 전환
 * @returns {Promise<{ role: string, name: string }>}
 * @throws {Error} 전환 실패 시
 */
export const switchRole = async () => {
  try {
    const { data } = await api.post(ENDPOINTS.AUTH.SWITCH_ROLE)
    return data
  } catch (error) {
    const message = error.response?.data?.message ?? '계정 전환에 실패했습니다.'
    throw new Error(message)
  }
}