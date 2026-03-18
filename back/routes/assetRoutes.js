const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { verifyAccessToken } = require('../middleware/authMiddleware');

// 모든 자산 라우트는 AT 검증 필수
router.use(verifyAccessToken);

// GET /api/assets/personal
router.get('/personal', assetController.getPersonalAssets);

// GET /api/assets/df
router.get('/df', assetController.getDfAssets);

module.exports = router;