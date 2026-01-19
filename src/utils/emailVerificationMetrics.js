/**
 * Email Verification Metrics
 * 
 * Tracks metrics for email verification system.
 * Metrics are stored in memory (can be extended to use Redis/database for persistence).
 * 
 * Future: Can be integrated with monitoring services (CloudWatch, Datadog, etc.)
 */

// In-memory metrics storage
// In production, consider using Redis or a time-series database
const metrics = {
  codesSent: 0,
  verificationsAttempted: 0,
  verificationsSucceeded: 0,
  verificationsFailed: 0,
  rateLimitHits: {
    email: 0,
    ip: 0,
    resendCooldown: 0
  },
  sesErrors: {
    total: 0,
    byType: {}
  },
  cleanupRuns: 0,
  codesDeleted: 0,
  lastReset: new Date()
};

/**
 * Reset metrics (useful for testing or periodic resets)
 */
const resetMetrics = () => {
  metrics.codesSent = 0;
  metrics.verificationsAttempted = 0;
  metrics.verificationsSucceeded = 0;
  metrics.verificationsFailed = 0;
  metrics.rateLimitHits = { email: 0, ip: 0, resendCooldown: 0 };
  metrics.sesErrors = { total: 0, byType: {} };
  metrics.cleanupRuns = 0;
  metrics.codesDeleted = 0;
  metrics.lastReset = new Date();
};

/**
 * Increment codes sent counter
 */
const incrementCodesSent = () => {
  metrics.codesSent++;
};

/**
 * Increment verification attempt counter
 * @param {boolean} success - Whether verification succeeded
 */
const incrementVerificationAttempt = (success) => {
  metrics.verificationsAttempted++;
  if (success) {
    metrics.verificationsSucceeded++;
  } else {
    metrics.verificationsFailed++;
  }
};

/**
 * Increment rate limit hit counter
 * @param {string} type - Rate limit type ('email', 'ip', 'resend_cooldown')
 */
const incrementRateLimitHit = (type) => {
  if (metrics.rateLimitHits[type] !== undefined) {
    metrics.rateLimitHits[type]++;
  }
};

/**
 * Increment SES error counter
 * @param {string} errorType - Error type (e.g., 'Throttling', 'MessageRejected')
 */
const incrementSESError = (errorType) => {
  metrics.sesErrors.total++;
  if (!metrics.sesErrors.byType[errorType]) {
    metrics.sesErrors.byType[errorType] = 0;
  }
  metrics.sesErrors.byType[errorType]++;
};

/**
 * Record cleanup job execution
 * @param {number} deletedCount - Number of codes deleted
 */
const recordCleanupJob = (deletedCount) => {
  metrics.cleanupRuns++;
  metrics.codesDeleted += deletedCount;
};

/**
 * Get all metrics
 * @returns {Object} Metrics object
 */
const getMetrics = () => {
  const successRate = metrics.verificationsAttempted > 0
    ? (metrics.verificationsSucceeded / metrics.verificationsAttempted * 100).toFixed(2)
    : 0;

  const failureRate = metrics.verificationsAttempted > 0
    ? (metrics.verificationsFailed / metrics.verificationsAttempted * 100).toFixed(2)
    : 0;

  return {
    ...metrics,
    successRate: `${successRate}%`,
    failureRate: `${failureRate}%`,
    uptime: Math.floor((new Date() - metrics.lastReset) / 1000) // seconds
  };
};

/**
 * Get verification success rate
 * @returns {number} Success rate as percentage (0-100)
 */
const getSuccessRate = () => {
  if (metrics.verificationsAttempted === 0) {
    return 0;
  }
  return (metrics.verificationsSucceeded / metrics.verificationsAttempted * 100);
};

/**
 * Get email delivery rate (approximate)
 * Based on codes sent vs verification attempts
 * @returns {number} Delivery rate as percentage (0-100)
 */
const getDeliveryRate = () => {
  if (metrics.codesSent === 0) {
    return 0;
  }
  // Approximate: assume codes that are verified were delivered
  // This is not 100% accurate but gives a good estimate
  return (metrics.verificationsSucceeded / metrics.codesSent * 100);
};

/**
 * Get rate limit hit rate
 * @returns {Object} Rate limit statistics
 */
const getRateLimitStats = () => {
  return {
    ...metrics.rateLimitHits,
    total: Object.values(metrics.rateLimitHits).reduce((sum, val) => sum + val, 0)
  };
};

/**
 * Get SES error statistics
 * @returns {Object} SES error statistics
 */
const getSESErrorStats = () => {
  return {
    total: metrics.sesErrors.total,
    byType: { ...metrics.sesErrors.byType },
    errorRate: metrics.codesSent > 0
      ? ((metrics.sesErrors.total / metrics.codesSent) * 100).toFixed(2) + '%'
      : '0%'
  };
};

/**
 * Check if metrics indicate issues (for alerting)
 * @returns {Object} Issues detected
 */
const checkForIssues = () => {
  const issues = [];
  const warnings = [];

  // Check success rate
  const successRate = getSuccessRate();
  if (metrics.verificationsAttempted > 10 && successRate < 50) {
    issues.push({
      type: 'LOW_SUCCESS_RATE',
      message: `Verification success rate is ${successRate.toFixed(2)}% (below 50%)`,
      severity: 'high'
    });
  } else if (metrics.verificationsAttempted > 10 && successRate < 70) {
    warnings.push({
      type: 'LOW_SUCCESS_RATE',
      message: `Verification success rate is ${successRate.toFixed(2)}% (below 70%)`,
      severity: 'medium'
    });
  }

  // Check SES error rate
  const sesErrorRate = metrics.codesSent > 0
    ? (metrics.sesErrors.total / metrics.codesSent) * 100
    : 0;
  if (sesErrorRate > 10) {
    issues.push({
      type: 'HIGH_SES_ERROR_RATE',
      message: `SES error rate is ${sesErrorRate.toFixed(2)}% (above 10%)`,
      severity: 'high'
    });
  } else if (sesErrorRate > 5) {
    warnings.push({
      type: 'HIGH_SES_ERROR_RATE',
      message: `SES error rate is ${sesErrorRate.toFixed(2)}% (above 5%)`,
      severity: 'medium'
    });
  }

  // Check rate limit hits
  const totalRateLimitHits = Object.values(metrics.rateLimitHits).reduce((sum, val) => sum + val, 0);
  if (totalRateLimitHits > 100) {
    warnings.push({
      type: 'HIGH_RATE_LIMIT_HITS',
      message: `High number of rate limit hits: ${totalRateLimitHits}`,
      severity: 'medium'
    });
  }

  return {
    issues,
    warnings,
    healthy: issues.length === 0 && warnings.length === 0
  };
};

module.exports = {
  incrementCodesSent,
  incrementVerificationAttempt,
  incrementRateLimitHit,
  incrementSESError,
  recordCleanupJob,
  getMetrics,
  getSuccessRate,
  getDeliveryRate,
  getRateLimitStats,
  getSESErrorStats,
  checkForIssues,
  resetMetrics
};

