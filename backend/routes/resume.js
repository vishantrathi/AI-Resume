const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadResume, getMyResume, getResumeById, getAllResumes } = require('../controllers/resumeController');
const { getResumeSkillGap, getCareerRoadmap } = require('../controllers/careerController');

// POST /api/resume/upload
router.post('/upload', protect, upload.single('resume'), uploadResume);

// GET /api/resume/me
router.get('/me', protect, getMyResume);

// GET /api/resume/all
router.get('/all', protect, getAllResumes);

// GET /api/resume/:id/skill-gap  — skill gap for the resume's best-matching job
router.get('/:id/skill-gap', protect, getResumeSkillGap);

// GET /api/resume/:id/career-roadmap  — personalised learning roadmap
router.get('/:id/career-roadmap', protect, getCareerRoadmap);

// GET /api/resume/:id
router.get('/:id', protect, getResumeById);

module.exports = router;
