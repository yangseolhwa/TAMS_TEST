const express = require("express");
const router = express.Router();
const authController = require("../controllers/authControllers");
const { verifyAccessToken } = require("../middleware/authMiddleware");

//  POST /api/auth/login
router.post("/login", authController.login);

// POST /api/auth/logout
router.post("/logout", verifyAccessToken, authController.logout);

// POST /api/auth/refresh
router.post("/refresh", authController.refresh);

module.exports = router;
