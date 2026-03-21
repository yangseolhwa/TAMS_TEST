const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { verifyAccessToken } = require('../middleware/authMiddleware');

// 모든 자산 라우트는 AT 검증 필수
router.use(verifyAccessToken);

// 조회
router.get('/personal', assetController.getPersonalAssets);
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
router.patch('/sw/move', assetController.moveSw);
router.patch('/df/move', assetController.moveDf);

module.exports = router;