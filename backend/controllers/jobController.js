const { body, validationResult } = require('express-validator');
const Job = require('../models/Job');
const { extractSkills } = require('../utils/nlpProcessor');

const jobValidation = [
  body('title').trim().notEmpty().withMessage('Job title is required'),
  body('company').trim().notEmpty().withMessage('Company name is required'),
  body('description').trim().notEmpty().withMessage('Job description is required'),
];

// POST /api/jobs
const createJob = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, company, description, requiredSkills, experience, education, location, applicationLink } = req.body;

  // Auto-extract skills from description if not provided
  const skills =
    requiredSkills && Array.isArray(requiredSkills) && requiredSkills.length > 0
      ? requiredSkills
      : extractSkills(description);

  const job = await Job.create({
    recruiter: req.user.id,
    title,
    company,
    description,
    requiredSkills: skills,
    experience: experience || '',
    education: education || '',
    location: location || '',
    applicationLink: applicationLink || '',
  });

  res.status(201).json(job);
};

// GET /api/jobs
const getAllJobs = async (_req, res) => {
  const jobs = await Job.find({ isActive: true })
    .populate('recruiter', 'name email')
    .sort({ createdAt: -1 });
  res.json(jobs);
};

// GET /api/jobs/:id
const getJobById = async (req, res) => {
  const job = await Job.findById(req.params.id).populate('recruiter', 'name email');
  if (!job) return res.status(404).json({ message: 'Job not found' });
  res.json(job);
};

// PUT /api/jobs/:id
const updateJob = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.recruiter.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Not authorised to update this job' });
  }

  const allowed = ['title', 'company', 'description', 'requiredSkills', 'experience', 'education', 'location', 'applicationLink', 'isActive'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) job[key] = req.body[key];
  }

  // Re-extract skills if description changed and no explicit skills provided
  if (req.body.description && (!req.body.requiredSkills || req.body.requiredSkills.length === 0)) {
    job.requiredSkills = extractSkills(job.description);
  }

  await job.save();
  res.json(job);
};

// DELETE /api/jobs/:id
const deleteJob = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.recruiter.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Not authorised to delete this job' });
  }
  await job.deleteOne();
  res.json({ message: 'Job removed' });
};

// GET /api/jobs/recruiter/mine
const getMyJobs = async (req, res) => {
  const jobs = await Job.find({ recruiter: req.user.id }).sort({ createdAt: -1 });
  res.json(jobs);
};

module.exports = { createJob, getAllJobs, getJobById, updateJob, deleteJob, getMyJobs, jobValidation };
