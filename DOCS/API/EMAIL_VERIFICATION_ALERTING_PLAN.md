# Email Verification Alerting Plan

This document outlines the alerting strategy for the email verification system. These alerts should be implemented when integrating with monitoring services (CloudWatch, Datadog, etc.).

## Overview

The email verification system includes comprehensive logging and metrics tracking. This plan describes how to set up alerts based on these metrics to ensure system health and detect issues early.

## Metrics Available

The system tracks the following metrics (via `emailVerificationMetrics.js`):

- **Codes Sent**: Total number of verification codes sent
- **Verification Attempts**: Total verification attempts (success + failure)
- **Verification Success Rate**: Percentage of successful verifications
- **Verification Failure Rate**: Percentage of failed verifications
- **Rate Limit Hits**: Per email, per IP, and resend cooldown hits
- **SES Errors**: Total errors and breakdown by error type
- **Cleanup Jobs**: Number of cleanup runs and codes deleted

## Alert Categories

### 1. High Priority Alerts (Immediate Action Required)

#### 1.1 Low Verification Success Rate
**Trigger**: Success rate < 50% for more than 10 attempts
**Severity**: High
**Action**: 
- Check SES configuration
- Review verification code expiration settings
- Check for code generation issues
- Review rate limiting settings

**Implementation**:
```javascript
// Example CloudWatch Alarm
{
  MetricName: 'VerificationSuccessRate',
  Threshold: 50,
  ComparisonOperator: 'LessThanThreshold',
  EvaluationPeriods: 1,
  Statistic: 'Average'
}
```

#### 1.2 High SES Error Rate
**Trigger**: SES error rate > 10% of codes sent
**Severity**: High
**Action**:
- Check AWS SES quota limits
- Verify SES account status (sandbox vs production)
- Check IAM permissions
- Review email template formatting
- Check for bounces/complaints in SES console

**Implementation**:
```javascript
// Example CloudWatch Alarm
{
  MetricName: 'SESErrorRate',
  Threshold: 10,
  ComparisonOperator: 'GreaterThanThreshold',
  EvaluationPeriods: 1,
  Statistic: 'Average'
}
```

#### 1.3 SES Quota Limit Approaching
**Trigger**: 
- Sandbox: > 180 emails sent in 24 hours (90% of 200 limit)
- Production: > 90% of daily quota
**Severity**: High
**Action**:
- Request production access if in sandbox
- Request quota increase if needed
- Implement additional rate limiting
- Notify operations team

**Implementation**:
```javascript
// Track via CloudWatch custom metric
// Alert when approaching quota
{
  MetricName: 'SESQuotaUsage',
  Threshold: 90,
  ComparisonOperator: 'GreaterThanThreshold',
  EvaluationPeriods: 1
}
```

### 2. Medium Priority Alerts (Monitor and Investigate)

#### 2.1 Moderate Success Rate Drop
**Trigger**: Success rate < 70% for more than 10 attempts
**Severity**: Medium
**Action**:
- Review recent verification attempts
- Check for pattern in failures
- Monitor for improvement
- Consider adjusting rate limits

#### 2.2 High Rate Limit Hits
**Trigger**: Total rate limit hits > 100 in 1 hour
**Severity**: Medium
**Action**:
- Check for abuse/attack patterns
- Review rate limit thresholds
- Consider IP blocking for repeated offenders
- Monitor user experience impact

#### 2.3 Moderate SES Error Rate
**Trigger**: SES error rate > 5% but < 10%
**Severity**: Medium
**Action**:
- Monitor error types
- Check for transient issues
- Review error logs
- Prepare for potential escalation

### 3. Low Priority Alerts (Informational)

#### 3.1 Cleanup Job Not Running
**Trigger**: No cleanup job run in 24 hours
**Severity**: Low
**Action**:
- Verify cleanup job is scheduled
- Check for job execution errors
- Review database size

#### 3.2 Unusual Verification Pattern
**Trigger**: 
- Sudden spike in verification attempts (> 3x normal)
- Unusual geographic distribution
**Severity**: Low
**Action**:
- Review logs for suspicious activity
- Check for legitimate traffic increase
- Monitor for potential abuse

## Implementation Options

### Option 1: AWS CloudWatch Alarms

**Setup Steps**:
1. Export metrics to CloudWatch using AWS SDK
2. Create CloudWatch alarms based on thresholds
3. Configure SNS topics for notifications
4. Set up email/SMS/Slack notifications

**Example Code**:
```javascript
// In emailVerificationMetrics.js - add CloudWatch export
const { CloudWatch } = require('@aws-sdk/client-cloudwatch');

const publishMetric = async (metricName, value, unit = 'Count') => {
  const cloudwatch = new CloudWatch({ region: process.env.AWS_REGION });
  
  await cloudwatch.putMetricData({
    Namespace: 'EmailVerification',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  });
};
```

### Option 2: Datadog Integration

**Setup Steps**:
1. Install Datadog agent or use API
2. Send metrics via Datadog API
3. Create monitors in Datadog dashboard
4. Configure alert notifications

**Example Code**:
```javascript
const datadog = require('datadog-metrics');

datadog.init({
  host: 'myhost',
  prefix: 'email_verification.',
  flushIntervalSeconds: 15
});

// Track metric
datadog.gauge('success_rate', successRate);
datadog.increment('codes_sent');
```

### Option 3: Custom Monitoring Service

**Setup Steps**:
1. Create monitoring endpoint (admin-only)
2. Periodically check metrics via `checkForIssues()`
3. Send alerts via email/SMS/webhook
4. Store metrics in database for historical analysis

**Example Code**:
```javascript
// Scheduled job to check metrics
const cron = require('node-cron');
const { checkForIssues } = require('./utils/emailVerificationMetrics');
const { sendAlert } = require('./services/alertService');

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const healthCheck = checkForIssues();
  
  if (!healthCheck.healthy) {
    // Send alerts for issues
    for (const issue of healthCheck.issues) {
      await sendAlert({
        severity: issue.severity,
        type: issue.type,
        message: issue.message
      });
    }
    
    // Send warnings
    for (const warning of healthCheck.warnings) {
      await sendAlert({
        severity: warning.severity,
        type: warning.type,
        message: warning.message
      });
    }
  }
});
```

## Recommended Alert Channels

1. **Email**: For high-priority alerts to operations team
2. **SMS/PagerDuty**: For critical issues requiring immediate attention
3. **Slack/Discord**: For team notifications and monitoring
4. **Dashboard**: Real-time metrics visualization

## Alert Frequency and Deduplication

- **Deduplication**: Group similar alerts within a time window (e.g., 15 minutes)
- **Escalation**: If alert persists for > 30 minutes, escalate to higher severity
- **Auto-resolve**: Clear alert when metric returns to normal for 5 minutes

## Monitoring Dashboard Recommendations

Create a dashboard showing:

1. **Real-time Metrics**:
   - Codes sent (last hour, last 24 hours)
   - Success rate (current, 1-hour average, 24-hour average)
   - SES error rate
   - Rate limit hits

2. **Historical Trends**:
   - Success rate over time
   - Error rate over time
   - Codes sent per day
   - Peak usage times

3. **Health Status**:
   - Current health check status
   - Active issues and warnings
   - Recent alerts

## Testing Alerts

Before deploying to production:

1. **Test Alert Triggers**:
   - Manually trigger each alert condition
   - Verify notifications are received
   - Confirm alert content is accurate

2. **Test Alert Resolution**:
   - Verify alerts clear when conditions normalize
   - Test deduplication logic
   - Verify escalation works

3. **Load Testing**:
   - Generate realistic traffic patterns
   - Verify alerts trigger at correct thresholds
   - Ensure no false positives

## Future Enhancements

1. **Predictive Alerts**: Use ML to predict issues before they occur
2. **Anomaly Detection**: Detect unusual patterns automatically
3. **Auto-remediation**: Automatically adjust rate limits or retry failed sends
4. **User Impact Metrics**: Track user experience impact of issues
5. **Cost Monitoring**: Track SES costs and optimize usage

## Notes

- All alerts should include context: timestamp, affected users, error details
- Alerts should be actionable with clear next steps
- Maintain alert history for post-incident analysis
- Review and adjust thresholds based on actual usage patterns
- Consider time-of-day patterns (e.g., lower thresholds during off-peak hours)

