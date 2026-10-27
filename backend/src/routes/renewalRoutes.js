const express = require('express');
const router = express.Router();
const renewalController = require('../controllers/renewalController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, authorizeRoles('admin'), renewalController.getRenewalRequests);
router.get('/:id/document/:kind', verifyToken, authorizeRoles('admin'), renewalController.getRenewalDocument);
router.put('/:id', verifyToken, authorizeRoles('admin'), renewalController.reviewRenewalRequest);
router.put('/:id/agreement', verifyToken, authorizeRoles('admin'), renewalController.sendRenewalAgreement);
router.put('/:id/complete', verifyToken, authorizeRoles('admin'), renewalController.completeRenewal);

module.exports = router;
