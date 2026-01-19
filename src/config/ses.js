/**
 * AWS SES Configuration
 * 
 * Configures AWS SES client for sending emails.
 * Uses environment variables for credentials and configuration.
 * 
 * Required Environment Variables:
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_REGION: AWS region (e.g., 'us-east-1')
 * - SES_FROM_EMAIL: Verified email address to send from (e.g., 'noreply@yourdomain.com')
 * 
 * Optional Environment Variables:
 * - SES_FROM_NAME: Display name for sender (e.g., 'SportsArena')
 *                 If not set, defaults to empty string
 * - AWS_SES_REGION: SES-specific region (if different from AWS_REGION)
 *                   If not set, uses AWS_REGION
 * 
 * Security:
 * - Credentials are loaded from environment variables (never hardcoded)
 * - Email address must be verified in AWS SES before sending
 * - IAM user must have ses:SendEmail and ses:SendRawEmail permissions
 */

require('dotenv').config();
const { SESClient } = require('@aws-sdk/client-ses');

// Validate required environment variables
const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'SES_FROM_EMAIL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️  Warning: Missing AWS SES environment variables: ${missingVars.join(', ')}`);
  console.warn('   SES email functionality will not work until these are configured.');
}

// Check optional environment variables
if (!process.env.SES_FROM_NAME) {
  console.warn('⚠️  Warning: SES_FROM_NAME not set. Emails will be sent without a display name.');
}

// AWS SES Client Configuration
// Use AWS_SES_REGION if provided, otherwise fall back to AWS_REGION
const SES_REGION = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1';

const sesClient = new SESClient({
  region: SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// SES Configuration Constants
// From email address (must be verified in SES)
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || '';

// From name (display name, optional)
const SES_FROM_NAME = process.env.SES_FROM_NAME || '';

// Validate SES_FROM_EMAIL format if provided
if (SES_FROM_EMAIL) {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(SES_FROM_EMAIL)) {
    console.warn(`⚠️  Warning: SES_FROM_EMAIL format appears invalid: ${SES_FROM_EMAIL}`);
    console.warn('   Please verify the email address is correct and verified in AWS SES.');
  }
}

module.exports = {
  sesClient,
  SES_FROM_EMAIL,
  SES_FROM_NAME,
  SES_REGION
};

