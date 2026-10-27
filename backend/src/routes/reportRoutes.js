const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/reports/dashboard:
 *   get:
 *     summary: สรุปข้อมูลหอพักแบบเรียลไทม์ (Admin เท่านั้น)
 *     description: แสดงสถิติห้องพัก รายรับ-รายจ่าย ยอดค้างชำระ และกำไรสุทธิ
 *     tags: [Reports & Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 * 
 * /api/reports/monthly-financial:
 *   get:
 *     summary: สรุป รายรับ-รายจ่าย รายเดือนสำหรับทำกราฟ (Admin เท่านั้น)
 *     tags: [Reports & Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *
 * /api/reports/rooms:
 *   get:
 *     summary: รายงานสถานะและข้อมูลห้องพัก
 *     tags: [Reports & Analytics]
 *     responses:
 *       200: { description: "Success" }
 *
 * /api/reports/tenants:
 *   get:
 *     summary: รายงานข้อมูลผู้เช่าและสัญญาที่ใช้งาน
 *     tags: [Reports & Analytics]
 *     responses:
 *       200: { description: "Success" }
 *
 * /api/reports/payments:
 *   get:
 *     summary: รายงานบิลและสถานะการชำระเงิน
 *     tags: [Reports & Analytics]
 *     responses:
 *       200: { description: "Success" }
 */
router.get('/dashboard', verifyToken, authorizeRoles('admin'), reportController.getDashboardSummary);
router.get('/monthly-financial', verifyToken, authorizeRoles('admin'), reportController.getMonthlyFinancialReport);
router.get('/rooms', verifyToken, authorizeRoles('admin'), reportController.getRoomReport);
router.get('/tenants', verifyToken, authorizeRoles('admin'), reportController.getTenantReport);
router.get('/payments', verifyToken, authorizeRoles('admin'), reportController.getPaymentReport);

module.exports = router;