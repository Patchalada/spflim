const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: สมัครสมาชิก / เพิ่มผู้ใช้งานใหม่
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password, first_name, last_name]
 *             properties:
 *               username: { type: string, example: "tenant01" }
 *               password: { type: string, example: "123456" }
 *               first_name: { type: string, example: "สมชาย" }
 *               last_name: { type: string, example: "ใจดี" }
 *               phone: { type: string, example: "0812345678" }
 *               role: { type: string, enum: [tenant], example: "tenant", description: "Optional. Public registration only permits tenant accounts." }
 *     responses:
 *       201: { description: "Tenant account created, pending admin approval" }
 *       403: { description: "Public registration does not permit admin accounts" }
 * 
 * /api/auth/login:
 *   post:
 *     summary: เข้าสู่ระบบเพื่อรับ Token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: "tenant01" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200: { description: "Login successful" }
 */
router.post('/register', authController.register);
router.get('/available-rooms', authController.getAvailableRooms);
router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getMyProfile);
router.put('/profile-image', verifyToken, authController.updateMyProfileImage);

module.exports = router;