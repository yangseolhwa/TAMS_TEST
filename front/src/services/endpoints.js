export const ENDPOINTS = {
  AUTH: {
    LOGIN:    '/auth/login',
    LOGOUT:   '/auth/logout',
    REFRESH:  '/auth/refresh',
  },
  ASSETS: {
    PERSONAL:           '/assets/personal',
    ENTERPRISE:         '/assets/enterprise',
    SW:                 '/assets/sw',
    ENTERPRISE_RETURN:  '/assets/enterprise/return',
    SW_RETURN:          '/assets/sw/return',
    ENTERPRISE_MOVE:    '/assets/enterprise/move',
    SW_MOVE:            '/assets/sw/move',
    REQUESTS:           '/assets/requests',
    ENTERPRISE_APPROVE: '/assets/enterprise/approve',
    ENTERPRISE_REJECT:  '/assets/enterprise/reject',
    SW_APPROVE:         '/assets/sw/approve',
    SW_REJECT:          '/assets/sw/reject',
    // ── DF ──────────────────────────────────────────────────
    DF:          '/assets/df',
    DF_RETURN:   '/assets/df/return',
    DF_MOVE:     '/assets/df/move',
    DF_STATE:    '/assets/df/state',
    DF_IMPORT:   '/assets/df/import',
    DF_EXPORT:   '/assets/df/export',
    DF_TEMPLATE: '/assets/df/template',
    // ── 대시보드 ────────────────────────────────────────────
    DASHBOARD:    '/assets/dashboard',
    DASHBOARD_DF: '/assets/dashboard/df',
    // ── 히스토리 ────────────────────────────────────────────
    HISTORY_DF:   '/assets/history/df',
  },
}