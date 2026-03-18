/**
 * authService.js
 * 인증 관련 API 통신 담당
 */

/**
 * @param {string} email
 * @returns {Promise<{ token: string }>}
 * @throws {Error} 로그인 실패 시
 */
export const login = async (email) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const { message } = await res.json().catch(() => ({}))
    throw new Error(message ?? '로그인에 실패했습니다.')
  }
  return res.json()

}