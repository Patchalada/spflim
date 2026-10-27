const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, authorizeRoles('admin'), supportController.getTickets);
router.put('/:id', verifyToken, authorizeRoles('admin'), supportController.updateTicket);

module.exports = router;
