require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');
const { startJobDiscoveryWorker } = require('./workers/jobDiscovery');
const { configurePassport, passport } = require('./config/passport');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
configurePassport();
app.use(passport.initialize());

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/candidate', require('./routes/candidate'));
app.use('/api/tracking', require('./routes/tracking'));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  // Start background job discovery worker (runs every 10 minutes)
  startJobDiscoveryWorker();
};

if (require.main === module) {
  start();
}

module.exports = app;
