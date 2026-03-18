import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let isRefreshing = false
let failedQueue = []

const processQueue = (error) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve()
  })
  failedQueue = []
}

// 인터셉터에서 refresh 시도를 건너뛸 URL 목록
const SKIP_REFRESH_URLS = [
  '/auth/refresh', // refresh 자체 실패는 무한루프 방지
  '/auth/me',      // 초기 인증 확인용 → 401은 정상 응답, refresh 불필요
  '/auth/login',
  '/auth/register',
]

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 403은 refresh 시도 없이 바로 로그인
    if (error.response?.status === 403) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    const shouldSkip = SKIP_REFRESH_URLS.some((url) =>
      originalRequest.url.includes(url)
    )

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldSkip
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await api.post('/auth/refresh')
        processQueue(null)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api