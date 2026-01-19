/**
 * Debug Routes (Development Only)
 * 
 * These endpoints are for development and verification purposes only.
 * Should be disabled or removed in production.
 * 
 * ⚠️ WARNING: These routes should be disabled in production!
 */

const express = require('express');
const router = express.Router();
const { getPublicImageUrl } = require('../config/s3');
const {
  getMetrics,
  getSuccessRate,
  getDeliveryRate,
  getRateLimitStats,
  getSESErrorStats,
  checkForIssues
} = require('../utils/emailVerificationMetrics');
const { getCleanupJobStatus, runCleanup } = require('../services/emailVerificationCleanupJob');

/**
 * CDN Verification Endpoint
 * GET /api/debug/cdn-check?s3Key=<key>
 * 
 * Verifies CDN URL generation and optionally checks if URL is reachable.
 * 
 * Query Parameters:
 * - s3Key (required): S3 object key to verify
 * - checkReachable (optional): If 'true', performs HEAD request to verify URL is reachable
 * 
 * Response:
 * {
 *   "s3Key": "...",
 *   "cdnUrl": "...",
 *   "reachable": true | false | null
 * }
 */
router.get('/cdn-check', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Debug endpoints are disabled in production',
      error_code: 'DEBUG_DISABLED'
    });
  }

  try {
    const { s3Key, checkReachable } = req.query;

    if (!s3Key) {
      return res.status(400).json({
        success: false,
        message: 's3Key query parameter is required',
        error_code: 'VALIDATION_ERROR'
      });
    }

    // Generate CDN URL using helper function
    const cdnUrl = getPublicImageUrl(s3Key);

    const response = {
      success: true,
      s3Key,
      cdnUrl,
      reachable: null
    };

    // Optionally check if URL is reachable
    if (checkReachable === 'true') {
      try {
        const https = require('https');
        const http = require('http');
        const { URL } = require('url');
        
        const urlObj = new URL(cdnUrl);
        const client = urlObj.protocol === 'https:' ? https : http;

        const checkPromise = new Promise((resolve, reject) => {
          const req = client.request(
            {
              hostname: urlObj.hostname,
              path: urlObj.pathname,
              method: 'HEAD',
              timeout: 5000
            },
            (res) => {
              resolve(res.statusCode >= 200 && res.statusCode < 400);
            }
          );

          req.on('error', (error) => {
            resolve(false);
          });

          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });

          req.end();
        });

        response.reachable = await checkPromise;
      } catch (error) {
        response.reachable = false;
        response.reachabilityError = error.message;
      }
    }

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking CDN URL',
      error: error.message
    });
  }
});

/**
 * Email Verification Metrics Endpoint
 * GET /api/debug/email-verification-metrics
 * 
 * Returns email verification system metrics including:
 * - Codes sent count
 * - Verification success/failure rates
 * - Rate limit hits
 * - SES error statistics
 * - Health check status
 * 
 * Response:
 * {
 *   "metrics": { ... },
 *   "successRate": "85.5%",
 *   "deliveryRate": "90.2%",
 *   "rateLimitStats": { ... },
 *   "sesErrorStats": { ... },
 *   "healthCheck": { ... }
 * }
 */
router.get('/email-verification-metrics', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Debug endpoints are disabled in production',
      error_code: 'DEBUG_DISABLED'
    });
  }

  try {
    const metrics = getMetrics();
    const successRate = getSuccessRate();
    const deliveryRate = getDeliveryRate();
    const rateLimitStats = getRateLimitStats();
    const sesErrorStats = getSESErrorStats();
    const healthCheck = checkForIssues();

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        codesSent: metrics.codesSent,
        verificationsAttempted: metrics.verificationsAttempted,
        verificationsSucceeded: metrics.verificationsSucceeded,
        verificationsFailed: metrics.verificationsFailed,
        cleanupRuns: metrics.cleanupRuns,
        codesDeleted: metrics.codesDeleted,
        uptime: metrics.uptime,
        lastReset: metrics.lastReset
      },
      successRate: `${successRate.toFixed(2)}%`,
      deliveryRate: `${deliveryRate.toFixed(2)}%`,
      rateLimitStats,
      sesErrorStats,
      healthCheck
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving metrics',
      error: error.message
    });
  }
});

/**
 * Email Verification Cleanup Job Status
 * GET /api/debug/email-verification-cleanup-status
 * 
 * Returns cleanup job status and configuration.
 * 
 * Response:
 * {
 *   "enabled": true,
 *   "schedule": "0 * * * *",
 *   "ageHours": 24,
 *   "running": true,
 *   "nextRun": "Scheduled"
 * }
 */
router.get('/email-verification-cleanup-status', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Debug endpoints are disabled in production',
      error_code: 'DEBUG_DISABLED'
    });
  }

  try {
    const status = getCleanupJobStatus();
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error retrieving cleanup job status',
      error: error.message
    });
  }
});

/**
 * Manually Trigger Cleanup Job
 * POST /api/debug/email-verification-cleanup-run
 * 
 * Manually triggers the cleanup job (for testing).
 * 
 * Response:
 * {
 *   "success": true,
 *   "deletedCount": 5,
 *   "olderThanHours": 24
 * }
 */
router.post('/email-verification-cleanup-run', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Debug endpoints are disabled in production',
      error_code: 'DEBUG_DISABLED'
    });
  }

  try {
    const result = await runCleanup();
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error running cleanup job',
      error: error.message
    });
  }
});

module.exports = router;

