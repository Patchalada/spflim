
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/public', settingsController.getPublicDormitoryName);
router.use(verifyToken, authorizeRoles('admin'));
router.get('/', settingsController.getSettings);
router.put('/rates', settingsController.updateRates);
router.put('/dormitory', settingsController.updateDormitoryDetails);
router.post('/room-types', settingsController.createRoomType);
router.put('/room-types/:id', settingsController.updateRoomType);
router.delete('/room-types/:id', settingsController.deleteRoomType);

module.exports = router;
