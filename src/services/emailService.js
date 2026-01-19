/**
 * Email Service
 * 
 * Handles sending emails via Amazon SES.
 * Includes retry logic, error handling, and throttling support.
 */

const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { sesClient, SES_FROM_EMAIL, SES_FROM_NAME, SES_REGION } = require('../config/ses');

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} Delay in milliseconds
 */
const calculateBackoffDelay = (attempt) => {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY);
};

/**
 * Check if error is retryable
 * @param {Error} error - Error object
 * @returns {boolean} True if error is retryable
 */
const isRetryableError = (error) => {
  // SES throttling errors
  if (error.name === 'Throttling' || error.name === 'ServiceQuotaExceededException') {
    return true;
  }

  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // 5xx server errors (transient)
  if (error.$metadata && error.$metadata.httpStatusCode >= 500) {
    return true;
  }

  // Rate limiting (429)
  if (error.$metadata && error.$metadata.httpStatusCode === 429) {
    return true;
  }

  return false;
};

/**
 * Format "From" address with optional display name
 * @param {string} email - Email address
 * @param {string} name - Display name (optional)
 * @returns {string} Formatted from address
 */
const formatFromAddress = (email, name) => {
  if (name && name.trim()) {
    return `${name.trim()} <${email}>`;
  }
  return email;
};

/**
 * Send email via Amazon SES
 * 
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML email body
 * @param {string} textBody - Plain text email body (optional but recommended)
 * @param {Object} options - Additional options
 * @param {number} [options.retryAttempt=0] - Current retry attempt (internal use)
 * @returns {Promise<Object>} SES send result with MessageId
 * @throws {Error} If email sending fails after all retries
 */
const sendEmail = async (to, subject, htmlBody, textBody = '', options = {}) => {
  const { retryAttempt = 0 } = options;

  // Validate required parameters
  if (!to || !subject || !htmlBody) {
    const error = new Error('Missing required parameters: to, subject, and htmlBody are required');
    error.statusCode = 400;
    error.errorCode = 'MISSING_PARAMETERS';
    throw error;
  }

  // Validate email format
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(to)) {
    const error = new Error('Invalid recipient email address format');
    error.statusCode = 400;
    error.errorCode = 'INVALID_EMAIL';
    throw error;
  }

  // Validate SES configuration
  if (!SES_FROM_EMAIL) {
    const error = new Error('SES_FROM_EMAIL is not configured');
    error.statusCode = 500;
    error.errorCode = 'SES_NOT_CONFIGURED';
    throw error;
  }

  // Format from address
  const fromAddress = formatFromAddress(SES_FROM_EMAIL, SES_FROM_NAME);

  // Prepare email parameters
  const emailParams = {
    Source: fromAddress,
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        }
      }
    }
  };

  // Add plain text body if provided
  if (textBody && textBody.trim()) {
    emailParams.Message.Body.Text = {
      Data: textBody,
      Charset: 'UTF-8'
    };
  }

  try {
    // Create and send email command
    const command = new SendEmailCommand(emailParams);
    const response = await sesClient.send(command);

    // Log success (in development/debug mode)
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      console.log(`[Email Service] Email sent successfully to ${to}. MessageId: ${response.MessageId}`);
    }

    return {
      success: true,
      messageId: response.MessageId,
      to,
      subject
    };
  } catch (error) {
    // Handle specific SES errors
    if (error.name === 'MessageRejected') {
      // Email address is invalid or rejected
      const errorObj = new Error(`Email rejected: ${error.message || 'Invalid recipient email address'}`);
      errorObj.statusCode = 400;
      errorObj.errorCode = 'EMAIL_REJECTED';
      errorObj.originalError = error;
      throw errorObj;
    }

    if (error.name === 'MailFromDomainNotVerifiedException') {
      // From email address is not verified in SES
      const errorObj = new Error('From email address is not verified in AWS SES');
      errorObj.statusCode = 500;
      errorObj.errorCode = 'FROM_EMAIL_NOT_VERIFIED';
      errorObj.originalError = error;
      throw errorObj;
    }

    if (error.name === 'ConfigurationSetDoesNotExistException') {
      // Configuration set doesn't exist (if using one)
      const errorObj = new Error('SES configuration set does not exist');
      errorObj.statusCode = 500;
      errorObj.errorCode = 'CONFIGURATION_SET_NOT_FOUND';
      errorObj.originalError = error;
      throw errorObj;
    }

    // Handle bounces and complaints (these are usually not retryable)
    if (error.name === 'BounceException' || error.name === 'ComplaintException') {
      const errorObj = new Error(`Email bounced or complaint received: ${error.message || 'Recipient email address issue'}`);
      errorObj.statusCode = 400;
      errorObj.errorCode = 'EMAIL_BOUNCED';
      errorObj.originalError = error;
      throw errorObj;
    }

    // Handle network errors and retryable errors
    if (isRetryableError(error) && retryAttempt < MAX_RETRY_ATTEMPTS) {
      const delay = calculateBackoffDelay(retryAttempt);
      
      // Log retry attempt
      console.warn(`[Email Service] Retryable error sending email to ${to}. Attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS}. Retrying in ${delay}ms...`);
      console.warn(`[Email Service] Error: ${error.name || error.code || error.message}`);

      // Wait before retry
      await sleep(delay);

      // Retry with incremented attempt
      return sendEmail(to, subject, htmlBody, textBody, { retryAttempt: retryAttempt + 1 });
    }

    // Non-retryable error or max retries exceeded
    const errorObj = new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
    errorObj.statusCode = error.$metadata?.httpStatusCode || 500;
    errorObj.errorCode = 'EMAIL_SEND_FAILED';
    errorObj.originalError = error;
    errorObj.retryAttempts = retryAttempt;

    // Log final failure
    console.error(`[Email Service] Failed to send email to ${to} after ${retryAttempt + 1} attempt(s)`);
    console.error(`[Email Service] Error: ${error.name || error.code || error.message}`);
    if (error.$metadata) {
      console.error(`[Email Service] HTTP Status: ${error.$metadata.httpStatusCode}`);
      console.error(`[Email Service] Request ID: ${error.$metadata.requestId}`);
    }

    throw errorObj;
  }
};

module.exports = {
  sendEmail
};

