const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/bills:
 *   get:
 *     summary: ดึงรายการบิลทั้งหมด
 *     tags: [Bills]
 *     responses:
 *       200: { description: "Success" }
 *   post:
 *     summary: ออกบิลค่าน้ำ-ค่าไฟประจำเดือน (Admin เท่านั้น)
 *     tags: [Bills]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contract_id, month, year, water_old_meter, water_new_meter, electric_old_meter, electric_new_meter, due_date]
 *             properties:
 *               contract_id: { type: integer, example: 1 }
 *               month: { type: integer, example: 9 }
 *               year: { type: integer, example: 2026 }
 *               water_old_meter: { type: number, example: 100 }
 *               water_new_meter: { type: number, example: 105 }
 *               electric_old_meter: { type: number, example: 1000 }
 *               electric_new_meter: { type: number, example: 1120 }
 *               due_date: { type: string, example: "2026-09-05" }
 *               extra_charges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [description, amount]
 *                   properties:
 *                     description: { type: string, example: "ค่าที่จอดรถ" }
 *                     amount: { type: number, example: 300 }
 *     responses:
 *       201: { description: "Bill created" }
 * /api/bills/last-meter/{contract_id}:
 *   get:
 *     summary: ดึงเลขมิเตอร์ล่าสุดของสัญญา
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: contract_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "Last meter readings" }
 */
router.get('/last-meter/:contract_id', verifyToken, authorizeRoles('admin'), billController.getLastMeter);
router.get('/:bill_id/slip', verifyToken, authorizeRoles('admin', 'tenant'), billController.getBillSlip);
router.get('/:bill_id', verifyToken, authorizeRoles('admin', 'tenant'), billController.getBillById);
router.get('/', verifyToken, authorizeRoles('admin'), billController.getBills);
router.post('/', verifyToken, authorizeRoles('admin'), billController.createBill);
router.put('/:bill_id/due-date', verifyToken, authorizeRoles('admin'), billController.updateBillDueDate);

module.exports = router;