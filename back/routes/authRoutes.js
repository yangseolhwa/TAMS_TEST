const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyAccessToken } = require("../middleware/authMiddleware");

//  POST /api/auth/login
router.post("/login", authController.login);

// POST /api/auth/logout
router.post("/logout", verifyAccessToken, authController.logout);

// POST /api/auth/refresh
router.post("/refresh", authController.refresh);

// GET /api/auth/users (admin only)
router.get("/users", verifyAccessToken, authController.getUsers);

// POST /api/auth/switch-role (admin <-> user, 연결된 계정 있는 경우만)
router.post('/switch-role', verifyAccessToken, authController.switchRole);

module.exports = router;
