const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/contracts:
 *   get:
 *     summary: ดึงรายการสัญญาเช่าทั้งหมด (Admin เท่านั้น)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: "Success" }
 *   post:
 *     summary: ทำสัญญาเช่าใหม่ (Admin เท่านั้น)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [room_id, tenant_id, start_date, end_date, deposit]
 *             properties:
 *               room_id: { type: integer, example: 1 }
 *               tenant_id: { type: integer, example: 3 }
 *               start_date: { type: string, example: "2026-09-01" }
 *               end_date: { type: string, example: "2027-08-31" }
 *               deposit: { type: number, example: 7000 }
 *     responses:
 *       201: { description: "Contract created" }
 * 
 * /api/contracts/{id}:
 *   put:
 *     summary: อัปเดตสถานะสัญญาเช่า (Admin เท่านั้น)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [active, terminated, expired], example: "terminated" }
 *               start_date: { type: string, example: "2026-09-01" }
 *               end_date: { type: string, example: "2027-08-31" }
 *               deposit: { type: number, example: 7000 }
 *     responses:
 *       200: { description: "Contract status updated" }
 */
router.get('/', verifyToken, authorizeRoles('admin'), contractController.getContracts);
router.get('/:id', verifyToken, contractController.getContractById);
router.post('/', verifyToken, authorizeRoles('admin'), contractController.createContract);

// เพิ่ม Route PUT สำหรับอัปเดตสถานะสัญญาเช่า
router.put('/:id', verifyToken, authorizeRoles('admin'), contractController.updateContractStatus);

module.exports = router;