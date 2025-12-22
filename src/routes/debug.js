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

module.exports = router;

