# Email Verification Cleanup Job

This document describes the scheduled cleanup job for expired email verification codes.

## Overview

The cleanup job automatically deletes expired email verification codes from the database to maintain data hygiene and prevent table bloat.

## Features

- **Scheduled Execution**: Runs automatically on a configurable schedule (default: hourly)
- **Startup Cleanup**: Optionally runs cleanup when the server starts
- **Configurable Age Threshold**: Delete codes older than specified hours (default: 24 hours)
- **Comprehensive Logging**: Logs all cleanup operations with statistics
- **Metrics Tracking**: Tracks cleanup statistics in metrics system
- **Graceful Error Handling**: Continues running even if individual cleanup runs fail

## Configuration

The cleanup job can be configured using environment variables:

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_VERIFICATION_CLEANUP_ENABLED` | `true` | Enable/disable the cleanup job. Set to `false` to disable. |
| `EMAIL_VERIFICATION_CLEANUP_SCHEDULE` | `0 * * * *` | Cron schedule for cleanup job. Default runs hourly at minute 0. |
| `EMAIL_VERIFICATION_CLEANUP_AGE_HOURS` | `24` | Delete codes older than this many hours. |
| `EMAIL_VERIFICATION_CLEANUP_ON_STARTUP` | `true` | Run cleanup when server starts. Set to `false` to disable. |

### Cron Schedule Examples

The cleanup job uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, 0 or 7 is Sunday)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
```

**Common Schedules**:
- `0 * * * *` - Every hour at minute 0 (default)
- `0 0 * * *` - Daily at midnight (UTC)
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight
- `*/30 * * * *` - Every 30 minutes

### Example Configuration

```bash
# Enable cleanup job (default)
EMAIL_VERIFICATION_CLEANUP_ENABLED=true

# Run cleanup every 6 hours
EMAIL_VERIFICATION_CLEANUP_SCHEDULE=0 */6 * * *

# Delete codes older than 48 hours
EMAIL_VERIFICATION_CLEANUP_AGE_HOURS=48

# Run cleanup on server startup (default)
EMAIL_VERIFICATION_CLEANUP_ON_STARTUP=true
```

## How It Works

1. **On Server Start**:
   - If `EMAIL_VERIFICATION_CLEANUP_ON_STARTUP=true`, runs cleanup once immediately
   - Starts the scheduled cleanup job

2. **Scheduled Execution**:
   - Runs according to the cron schedule
   - Deletes codes where `created_at < NOW() - INTERVAL 'X hours'` OR `expires_at < NOW() - INTERVAL 'X hours'`
   - Logs cleanup statistics
   - Updates metrics

3. **On Server Shutdown**:
   - Stops the scheduled job gracefully
   - Ensures no orphaned processes

## Manual Execution

### Via Debug Endpoint (Development Only)

```bash
# Check cleanup job status
GET /api/debug/email-verification-cleanup-status

# Manually trigger cleanup
POST /api/debug/email-verification-cleanup-run
```

### Via Code

```javascript
const { runCleanup } = require('./services/emailVerificationCleanupJob');

// Run cleanup manually
const result = await runCleanup();
console.log(`Deleted ${result.deletedCount} codes`);
```

## Monitoring

### Logs

The cleanup job logs to console with the prefix `[Email Verification Cleanup]`:

```
[Email Verification Cleanup] Starting cleanup job (deleting codes older than 24 hours)...
[Email Verification Cleanup] ✅ Cleanup completed: 5 codes deleted
```

### Metrics

Cleanup statistics are tracked in the metrics system:
- `cleanupRuns`: Number of cleanup jobs executed
- `codesDeleted`: Total number of codes deleted

View metrics via:
```bash
GET /api/debug/email-verification-metrics
```

## Best Practices

1. **Schedule Frequency**:
   - For high-traffic systems: Run hourly or every 6 hours
   - For low-traffic systems: Daily is sufficient
   - Balance between database load and table size

2. **Age Threshold**:
   - Default 24 hours is usually sufficient
   - Increase if you need longer retention for debugging
   - Decrease if you want faster cleanup

3. **Startup Cleanup**:
   - Enable for production to clean up after deployments
   - Can disable if you prefer scheduled-only cleanup

4. **Monitoring**:
   - Monitor cleanup job logs for errors
   - Track `codesDeleted` metric to ensure cleanup is working
   - Alert if cleanup fails repeatedly

## Troubleshooting

### Cleanup Job Not Running

1. Check `EMAIL_VERIFICATION_CLEANUP_ENABLED` is not `false`
2. Verify cron schedule is valid: `cron.validate(schedule)`
3. Check server logs for errors
4. Verify database connection is working

### Too Many Codes Not Deleted

1. Check `EMAIL_VERIFICATION_CLEANUP_AGE_HOURS` threshold
2. Verify cleanup job is running (check logs)
3. Check if cleanup is actually deleting codes (check metrics)

### Cleanup Job Failing

1. Check database connection
2. Verify table `email_verification_codes` exists
3. Check database permissions
4. Review error logs for specific error messages

## Disabling Cleanup

To completely disable the cleanup job:

```bash
EMAIL_VERIFICATION_CLEANUP_ENABLED=false
```

This will:
- Skip startup cleanup
- Not start the scheduled job
- Still allow manual cleanup via code or debug endpoint

## Production Considerations

1. **Time Zone**: Cron schedule uses UTC by default. Adjust if needed.
2. **Database Load**: Schedule cleanup during off-peak hours if possible.
3. **Monitoring**: Set up alerts for cleanup job failures.
4. **Backup**: Ensure database backups run before cleanup if needed.
5. **Testing**: Test cleanup job in staging before production deployment.

## Related Documentation

- [Email Verification Service](../services/emailVerificationService.js)
- [Email Verification Metrics](../utils/emailVerificationMetrics.js)
- [Email Verification Logger](../utils/emailVerificationLogger.js)
- [Email Verification Alerting Plan](./EMAIL_VERIFICATION_ALERTING_PLAN.md)

