const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: GitHubStrategy } = require('passport-github2');
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const User = require('../models/User');

function defaultNameFromEmail(email, fallbackPrefix) {
  if (!email || typeof email !== 'string') return `${fallbackPrefix} User`;
  const prefix = email.split('@')[0] || fallbackPrefix;
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 60);
}

async function upsertOAuthUser({ email, name, provider, providerId, role, avatarUrl }) {
  if (!email) {
    throw new Error('No email address was returned by provider');
  }

  const safeRole = role === 'recruiter' ? 'recruiter' : 'candidate';

  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({
      name: name || defaultNameFromEmail(email, provider),
      email: email.toLowerCase(),
      password: '',
      role: safeRole,
      authProvider: provider,
      providerId,
      avatarUrl: avatarUrl || '',
    });
  } else {
    let changed = false;
    if (!user.authProvider) {
      user.authProvider = provider;
      changed = true;
    }
    if (!user.providerId) {
      user.providerId = providerId;
      changed = true;
    }
    if (!user.avatarUrl && avatarUrl) {
      user.avatarUrl = avatarUrl;
      changed = true;
    }
    if (!user.password) {
      user.password = '';
      changed = true;
    }
    if (changed) {
      await user.save();
    }
  }

  return user;
}

function roleFromOAuthState(req) {
  try {
    const rawState = req?.query?.state;
    if (!rawState) return 'candidate';
    const parsed = JSON.parse(Buffer.from(String(rawState), 'base64').toString('utf8'));
    return parsed?.role === 'recruiter' ? 'recruiter' : 'candidate';
  } catch (_err) {
    return 'candidate';
  }
}

function configurePassport() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const githubClientId = process.env.GITHUB_CLIENT_ID || '';
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || '';
  const msClientId = process.env.MICROSOFT_CLIENT_ID || '';
  const msClientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
  const msTenant = process.env.MICROSOFT_TENANT_ID || 'common';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

  if (googleClientId && googleClientSecret) {
    passport.use(
      'google',
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: `${backendUrl}/api/auth/oauth/google/callback`,
          scope: ['profile', 'email'],
          passReqToCallback: true,
        },
        async (req, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile?.emails?.[0]?.value || '';
            const name = profile?.displayName || defaultNameFromEmail(email, 'Google');
            const avatarUrl = profile?.photos?.[0]?.value || '';
            const role = roleFromOAuthState(req);
            const user = await upsertOAuthUser({
              email,
              name,
              provider: 'google',
              providerId: profile.id,
              role,
              avatarUrl,
            });
            done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  if (githubClientId && githubClientSecret) {
    passport.use(
      'github',
      new GitHubStrategy(
        {
          clientID: githubClientId,
          clientSecret: githubClientSecret,
          callbackURL: `${backendUrl}/api/auth/oauth/github/callback`,
          scope: ['user:email'],
          passReqToCallback: true,
        },
        async (req, _accessToken, _refreshToken, profile, done) => {
          try {
            const primaryEmail = Array.isArray(profile?.emails)
              ? (profile.emails.find((e) => e.verified)?.value || profile.emails[0]?.value)
              : '';
            const email = primaryEmail || `${profile.username}@users.noreply.github.com`;
            const name = profile?.displayName || defaultNameFromEmail(email, 'GitHub');
            const avatarUrl = profile?.photos?.[0]?.value || '';
            const user = await upsertOAuthUser({
              email,
              name,
              provider: 'github',
              providerId: profile.id,
              role: roleFromOAuthState(req),
              avatarUrl,
            });
            done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  if (msClientId && msClientSecret) {
    passport.use(
      'microsoft',
      new MicrosoftStrategy(
        {
          clientID: msClientId,
          clientSecret: msClientSecret,
          callbackURL: `${backendUrl}/api/auth/oauth/microsoft/callback`,
          tenant: msTenant,
          scope: ['user.read'],
          passReqToCallback: true,
        },
        async (req, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile?.emails?.[0] || profile?.username || '';
            const name = profile?.displayName || defaultNameFromEmail(email, 'Microsoft');
            const avatarUrl = '';
            const user = await upsertOAuthUser({
              email,
              name,
              provider: 'microsoft',
              providerId: profile.id,
              role: roleFromOAuthState(req),
              avatarUrl,
            });
            done(null, user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => done(null, { id }));
}

module.exports = { configurePassport, passport };
