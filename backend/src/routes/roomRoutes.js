const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/**
 * @openapi
 * /api/rooms:
 *   get:
 *     summary: ดึงข้อมูลห้องพักทั้งหมด
 *     tags: [Rooms]
 *     responses:
 *       200: { description: "Success" }
 *   post:
 *     summary: เพิ่มห้องพักใหม่ (Admin เท่านั้น)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [room_number, floor, room_type]
 *             properties:
 *               room_number: { type: string, example: "101" }
 *               floor: { type: integer, example: 1 }
 *               room_type: { type: string, example: "Air Conditioner" }
 *               status: { type: string, enum: [vacant, occupied, maintenance], example: "vacant" }
 *     responses:
 *       201: { description: "Room created" }
 * 
 * /api/rooms/{id}:
 *   put:
 *     summary: แก้ไขข้อมูลห้องพัก (Admin เท่านั้น)
 *     tags: [Rooms]
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
 *               room_number: { type: string, example: "101" }
 *               floor: { type: integer, example: 1 }
 *               room_type: { type: string, example: "Air Conditioner" }
 *               status: { type: string, example: "vacant" }
 *     responses:
 *       200: { description: "Room updated" }
 *   delete:
 *     summary: ลบห้องพัก (Admin เท่านั้น)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "Room deleted" }
 */
router.get('/', verifyToken, roomController.getRooms);
router.post('/', verifyToken, authorizeRoles('admin'), roomController.createRoom);
router.put('/:id', verifyToken, authorizeRoles('admin'), roomController.updateRoom);
router.delete('/:id', verifyToken, authorizeRoles('admin'), roomController.deleteRoom);

module.exports = router;