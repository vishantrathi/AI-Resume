const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  ingestTrackingEvent,
  getMyTrackingSummary,
  getAdminTrackingOverview,
} = require('../controllers/trackingController');

router.post('/events', protect, ingestTrackingEvent);
router.get('/me-summary', protect, getMyTrackingSummary);
router.get('/admin/overview', protect, requireRole('recruiter'), getAdminTrackingOverview);

module.exports = router;
