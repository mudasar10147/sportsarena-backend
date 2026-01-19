require('dotenv').config();

// Load and validate CDN configuration early (fail fast if misconfigured)
// This will exit the process if CDN_BASE_URL is missing or invalid
require('./config/s3');

const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (needed for Railway, Heroku, etc. to get correct client IP)
// This ensures req.ip is set correctly from X-Forwarded-For header
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route (must be before API routes to avoid 404)
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// API v1 Routes - Base URL: /api/v1/
// Following REST API architecture with versioned base URL
const v1Routes = require('./routes/v1');
app.use('/api/v1', v1Routes);

// Debug routes (development only)
if (process.env.NODE_ENV !== 'production') {
  const debugRoutes = require('./routes/debug');
  app.use('/api/debug', debugRoutes);
  console.log('⚠️  Debug routes enabled at /api/debug (development only)');
}

// Error handling middleware (must be after all routes)
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler); // Handle 404 for undefined routes
app.use(errorHandler); // Handle all errors

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SportsArena backend server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  
  // Start email verification cleanup job
  // This runs both in production (via start.js) and development (via server.js directly)
  const { startCleanupJob, runStartupCleanup } = require('./services/emailVerificationCleanupJob');
  
  // Run cleanup on startup (if enabled)
  runStartupCleanup().catch(error => {
    console.error('[Server] Failed to run initial cleanup:', error.message);
    // Don't fail server if cleanup fails
  });
  
  // Start scheduled cleanup job
  startCleanupJob();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  // Stop cleanup job
  const { stopCleanupJob } = require('./services/emailVerificationCleanupJob');
  stopCleanupJob();
  
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  
  // Stop cleanup job
  const { stopCleanupJob } = require('./services/emailVerificationCleanupJob');
  stopCleanupJob();
  
  await pool.end();
  process.exit(0);
});

module.exports = app;

