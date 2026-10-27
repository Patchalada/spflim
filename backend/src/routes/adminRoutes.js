const express = require('express');
const adminController = require('../controllers/adminController');
const {
  verifyToken,
  authorizeRoles,
  requirePrimaryAdmin
} = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /api/admins:
 *   get:
 *     summary: ดูบัญชีแอดมิน (ผู้ดูแลระบบ)
 *     tags: [Admin Accounts]
 *     responses:
 *       200: { description: "Admin accounts" }
 *       403: { description: "Admin role required" }
 *   post:
 *     summary: เพิ่มบัญชีแอดมิน (แอดมินหลักเท่านั้น)
 *     tags: [Admin Accounts]
 *     responses:
 *       201: { description: "Admin account created" }
 *       403: { description: "Primary admin only" }
 * /api/admins/{id}:
 *   delete:
 *     summary: ลบบัญชีแอดมิน (แอดมินหลักเท่านั้น; ลบบัญชีแอดมินหลักไม่ได้)
 *     tags: [Admin Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "Admin account deleted" }
 *       403: { description: "Primary admin only" }
 *       409: { description: "Primary admin or account has linked contracts" }
 */
router.use(verifyToken);
router.get('/', authorizeRoles('admin'), adminController.listAdmins);
router.post('/', requirePrimaryAdmin, adminController.createAdmin);
router.delete('/:id', requirePrimaryAdmin, adminController.deleteAdmin);

module.exports = router;
