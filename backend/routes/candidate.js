const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getCandidateProfile,
  markJobAction,
  getJobActions,
  getSkillGap,
  getCandidatesForRecruiter,
} = require('../controllers/matchController');

// GET /api/candidate/profile
router.get('/profile', protect, requireRole('candidate'), getCandidateProfile);

// POST /api/candidate/job-actions
router.post('/job-actions', protect, requireRole('candidate'), markJobAction);

// GET /api/candidate/job-actions?type=applied|removed
router.get('/job-actions', protect, requireRole('candidate'), getJobActions);

// GET /api/candidate/skill-gap/:jobId
router.get('/skill-gap/:jobId', protect, requireRole('candidate'), getSkillGap);

// GET /api/recruiter/candidates
router.get('/recruiter/candidates', protect, requireRole('recruiter'), getCandidatesForRecruiter);

module.exports = router;
