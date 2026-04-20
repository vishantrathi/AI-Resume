const express = require('express');
const router = express.Router();
const {
	register,
	registerValidation,
	login,
	loginValidation,
	getProfile,
	deleteProfile,
	oauthSuccess,
	oauthFailure,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { passport } = require('../config/passport');

function ensureProvider(provider) {
	return (req, res, next) => {
		if (!passport._strategy(provider)) {
			return res.status(503).json({
				message: `${provider} OAuth is not configured. Set ${provider.toUpperCase()} client credentials in environment variables.`,
			});
		}
		return next();
	};
}

const oauthStart = (provider) => (req, res, next) => {
	const role = req.query.role === 'recruiter' ? 'recruiter' : 'candidate';
	const state = Buffer.from(JSON.stringify({ role }), 'utf8').toString('base64');
	passport.authenticate(provider, { session: false, state })(req, res, next);
};

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/profile', protect, getProfile);
router.delete('/profile', protect, deleteProfile);

router.get('/oauth/google', ensureProvider('google'), oauthStart('google'));
router.get(
	'/oauth/google/callback',
	ensureProvider('google'),
	passport.authenticate('google', { session: false, failureRedirect: '/api/auth/oauth/failure' }),
	oauthSuccess
);

router.get('/oauth/github', ensureProvider('github'), oauthStart('github'));
router.get(
	'/oauth/github/callback',
	ensureProvider('github'),
	passport.authenticate('github', { session: false, failureRedirect: '/api/auth/oauth/failure' }),
	oauthSuccess
);

router.get('/oauth/microsoft', ensureProvider('microsoft'), oauthStart('microsoft'));
router.get(
	'/oauth/microsoft/callback',
	ensureProvider('microsoft'),
	passport.authenticate('microsoft', { session: false, failureRedirect: '/api/auth/oauth/failure' }),
	oauthSuccess
);

router.get('/oauth/failure', oauthFailure);

module.exports = router;
