export const ENDPOINTS = {
  AUTH: {
    LOGIN:   '/auth/login',
    LOGOUT:  '/auth/logout',
    REFRESH: '/auth/refresh',
  },
  ASSETS: {
    // 개인 자산
    PERSONAL:           '/assets/personal',
    // Enterprise(PC)
    ENTERPRISE:         '/assets/enterprise',
    ENTERPRISE_LIST:    '/assets/enterprise',
    ENTERPRISE_RETURN:  '/assets/enterprise/return',
    ENTERPRISE_MOVE:    '/assets/enterprise/move',
    ENTERPRISE_STATE:   '/assets/enterprise/state',
    ENTERPRISE_APPROVE: '/assets/enterprise/approve',
    ENTERPRISE_REJECT:  '/assets/enterprise/reject',
    // SW
    SW:         '/assets/sw',
    SW_LIST:    '/assets/sw',
    SW_RETURN:  '/assets/sw/return',
    SW_MOVE:    '/assets/sw/move',
    SW_STATE:   '/assets/sw/state',
    SW_APPROVE: '/assets/sw/approve',
    SW_REJECT:  '/assets/sw/reject',
    SW_ASSIGN:  '/assets/sw/assign',
    // 요청
    REQUESTS: '/assets/requests',
    // 대시보드
    DASHBOARD:    '/assets/dashboard',
    DASHBOARD_DF: '/assets/dashboard/df',
    // DF
    DF:          '/assets/df',
    DF_RETURN:   '/assets/df/return',
    DF_MOVE:     '/assets/df/move',
    DF_STATE:    '/assets/df/state',
    DF_IMPORT:   '/assets/df/import',
    DF_EXPORT:   '/assets/df/export',
    DF_TEMPLATE: '/assets/df/template',
    // 히스토리
    HISTORY_PERSONAL: '/assets/history/personal',
    HISTORY_DF:       '/assets/history/df',
  },
}