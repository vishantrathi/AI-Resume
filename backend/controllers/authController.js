const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Match = require('../models/Match');
const Job = require('../models/Job');
const JobAction = require('../models/JobAction');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';
const JWT_EXPIRES = '7d';

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function toAuthUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl || '',
  };
}

function buildFrontendAuthRedirect(user) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const token = generateToken(user);
  const userPayload = Buffer.from(JSON.stringify(toAuthUser(user))).toString('base64');
  return `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}&user=${encodeURIComponent(userPayload)}`;
}

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['candidate', 'recruiter']).withMessage('Invalid role'),
];

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already in use' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, role: role || 'candidate' });

  res.status(201).json({
    token: generateToken(user),
    user: toAuthUser(user),
  });
};

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  if (!user.password) {
    return res.status(401).json({ message: 'This account uses social login. Please sign in with your provider.' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });

  res.json({
    token: generateToken(user),
    user: toAuthUser(user),
  });
};

const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

const deleteProfile = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.role === 'candidate') {
    await Promise.all([
      Resume.deleteMany({ candidate: user._id }),
      Match.deleteMany({ candidate: user._id }),
      JobAction.deleteMany({ candidate: user._id }),
    ]);
  }

  if (user.role === 'recruiter') {
    const recruiterJobs = await Job.find({ recruiter: user._id }).select('_id');
    const recruiterJobIds = recruiterJobs.map((job) => job._id);

    await Promise.all([
      Match.deleteMany({ job: { $in: recruiterJobIds } }),
      Job.deleteMany({ recruiter: user._id }),
      JobAction.deleteMany({ candidate: user._id }),
      Match.deleteMany({ candidate: user._id }),
      Resume.deleteMany({ candidate: user._id }),
    ]);
  }

  await user.deleteOne();
  res.json({ message: 'Profile and related data deleted successfully' });
};

const oauthSuccess = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'OAuth authentication failed' });
  }
  return res.redirect(buildFrontendAuthRedirect(req.user));
};

const oauthFailure = async (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Social login failed')}`);
};

module.exports = {
  register,
  registerValidation,
  login,
  loginValidation,
  getProfile,
  deleteProfile,
  oauthSuccess,
  oauthFailure,
};
