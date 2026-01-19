/**
 * Email Verification Cleanup Job
 * 
 * Scheduled job to clean up expired email verification codes.
 * 
 * This job:
 * - Deletes codes older than 24 hours (configurable)
 * - Runs on a schedule (hourly or daily, configurable)
 * - Logs cleanup statistics
 * - Handles errors gracefully
 * 
 * Configuration (via environment variables):
 * - EMAIL_VERIFICATION_CLEANUP_ENABLED: Enable/disable cleanup job (default: true)
 * - EMAIL_VERIFICATION_CLEANUP_SCHEDULE: Cron schedule (default: '0 * * * *' = hourly)
 * - EMAIL_VERIFICATION_CLEANUP_AGE_HOURS: Delete codes older than this (default: 24)
 * - EMAIL_VERIFICATION_CLEANUP_ON_STARTUP: Run cleanup on server startup (default: true)
 */

const cron = require('node-cron');
const { cleanupExpiredCodes } = require('./emailVerificationService');
const { logCleanupJob } = require('../utils/emailVerificationLogger');
const { recordCleanupJob } = require('../utils/emailVerificationMetrics');

// Configuration from environment variables
const CLEANUP_ENABLED = process.env.EMAIL_VERIFICATION_CLEANUP_ENABLED !== 'false'; // Default: true
const CLEANUP_SCHEDULE = process.env.EMAIL_VERIFICATION_CLEANUP_SCHEDULE || '0 * * * *'; // Default: hourly at minute 0
const CLEANUP_AGE_HOURS = parseInt(process.env.EMAIL_VERIFICATION_CLEANUP_AGE_HOURS || '24', 10);
const CLEANUP_ON_STARTUP = process.env.EMAIL_VERIFICATION_CLEANUP_ON_STARTUP !== 'false'; // Default: true

let cleanupJob = null;

/**
 * Run cleanup job once
 * @returns {Promise<Object>} Cleanup result
 */
const runCleanup = async () => {
  try {
    console.log(`[Email Verification Cleanup] Starting cleanup job (deleting codes older than ${CLEANUP_AGE_HOURS} hours)...`);
    
    const result = await cleanupExpiredCodes(CLEANUP_AGE_HOURS);
    
    if (result.deletedCount > 0) {
      console.log(`[Email Verification Cleanup] ✅ Cleanup completed: ${result.deletedCount} codes deleted`);
    } else {
      console.log(`[Email Verification Cleanup] ✅ Cleanup completed: No codes to delete`);
    }
    
    return result;
  } catch (error) {
    console.error('[Email Verification Cleanup] ❌ Cleanup job failed:', error.message);
    console.error(error);
    
    // Log error but don't throw - we want the job to continue running
    logCleanupJob(0, CLEANUP_AGE_HOURS);
    
    return {
      success: false,
      deletedCount: 0,
      error: error.message
    };
  }
};

/**
 * Start the scheduled cleanup job
 * @returns {Object|null} Cron job instance or null if disabled
 */
const startCleanupJob = () => {
  if (!CLEANUP_ENABLED) {
    console.log('[Email Verification Cleanup] ⏭️  Cleanup job is disabled (EMAIL_VERIFICATION_CLEANUP_ENABLED=false)');
    return null;
  }

  // Validate cron schedule
  if (!cron.validate(CLEANUP_SCHEDULE)) {
    console.error(`[Email Verification Cleanup] ❌ Invalid cron schedule: ${CLEANUP_SCHEDULE}`);
    console.error('[Email Verification Cleanup] Using default schedule: 0 * * * * (hourly)');
    cleanupJob = cron.schedule('0 * * * *', runCleanup, {
      scheduled: true,
      timezone: 'UTC'
    });
  } else {
    cleanupJob = cron.schedule(CLEANUP_SCHEDULE, runCleanup, {
      scheduled: true,
      timezone: 'UTC'
    });
  }

  console.log(`[Email Verification Cleanup] ✅ Scheduled cleanup job started`);
  console.log(`[Email Verification Cleanup]    Schedule: ${CLEANUP_SCHEDULE}`);
  console.log(`[Email Verification Cleanup]    Age threshold: ${CLEANUP_AGE_HOURS} hours`);
  
  return cleanupJob;
};

/**
 * Stop the scheduled cleanup job
 */
const stopCleanupJob = () => {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    console.log('[Email Verification Cleanup] ⏸️  Cleanup job stopped');
  }
};

/**
 * Run cleanup on server startup (if enabled)
 */
const runStartupCleanup = async () => {
  if (!CLEANUP_ON_STARTUP) {
    console.log('[Email Verification Cleanup] ⏭️  Startup cleanup is disabled (EMAIL_VERIFICATION_CLEANUP_ON_STARTUP=false)');
    return;
  }

  if (!CLEANUP_ENABLED) {
    console.log('[Email Verification Cleanup] ⏭️  Skipping startup cleanup (cleanup job is disabled)');
    return;
  }

  console.log('[Email Verification Cleanup] 🚀 Running cleanup on startup...');
  await runCleanup();
};

/**
 * Get cleanup job status
 * @returns {Object} Status information
 */
const getCleanupJobStatus = () => {
  return {
    enabled: CLEANUP_ENABLED,
    schedule: CLEANUP_SCHEDULE,
    ageHours: CLEANUP_AGE_HOURS,
    running: cleanupJob !== null,
    nextRun: cleanupJob ? 'Scheduled' : 'Not running'
  };
};

module.exports = {
  startCleanupJob,
  stopCleanupJob,
  runCleanup,
  runStartupCleanup,
  getCleanupJobStatus
};

