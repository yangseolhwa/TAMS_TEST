const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const upload = require('../middleware/excelUpload');
const {
  importDf,
  downloadDfTemplate,
  importSwOriginal,
  importEnterpriseOriginal,
} = require('../controllers/importController');
const { exportDf } = require('../controllers/exportController');
const { verifyAccessToken } = require('../middleware/authMiddleware');

// 모든 자산 라우트는 AT 검증 필수
router.use(verifyAccessToken);

// 조회
router.get('/personal', assetController.getPersonalAssets);
router.get('/dashboard', assetController.getDashboard);
router.get('/dashboard/df', assetController.getDfDashboard);
router.get('/sw', assetController.getSwList);
router.get('/enterprise', assetController.getEnterpriseList);
router.get('/df', assetController.getDfAssets);

// 등록 요청 목록 조회
router.get('/requests', assetController.getRequests);

// 등록
router.post('/enterprise', assetController.registerEnterprise);
router.post('/sw', assetController.registerSw);
router.post('/df', assetController.registerDf);

// 관리자 승인 / 반려
router.patch('/enterprise/approve/:requestId', assetController.approveEnterprise);
router.patch('/enterprise/reject/:requestId',  assetController.rejectEnterprise);
router.patch('/sw/approve/:requestId', assetController.approveSw);
router.patch('/sw/reject/:requestId', assetController.rejectSw);

// 반납
router.patch('/enterprise/return', assetController.returnEnterprise);
router.patch('/sw/return', assetController.returnSw);
router.patch('/df/return', assetController.returnDf);

// 이동
router.patch('/enterprise/move', assetController.moveEnterprise);
router.patch('/df/move', assetController.moveDf);

// 할당
router.patch('/sw/assign', assetController.assignSwLicense);

// DF 엑셀 import / export / 양식 다운로드
router.post('/df/import', upload.single('file'), importDf);
router.get('/df/export', exportDf);
router.get('/df/template', downloadDfTemplate);

// 원본 데이터 1회성 Import (관리자 전용)
router.post('/sw/import/original', upload.single('file'), importSwOriginal);
router.post('/enterprise/import/original', upload.single('file'), importEnterpriseOriginal);

// 히스토리 조회
router.get('/history/personal', assetController.getPersonalHistory);
router.get('/history/df', assetController.getDfHistory);

// 히스토리 아카이빙 (admin)
router.post('/history/sw/archive', assetController.archiveSwHistory);
router.post('/history/enterprise/archive', assetController.archiveEnterpriseHistory);
router.post('/history/df/archive', assetController.archiveDfHistory);

// 히스토리 아카이브 조회 (admin)
router.get('/history/sw/archive', assetController.getSwHistoryArchive);
router.get('/history/enterprise/archive', assetController.getEnterpriseHistoryArchive);
router.get('/history/df/archive', assetController.getDfHistoryArchive);

module.exports = router;