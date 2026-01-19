/**
 * Email Template Service
 * 
 * Handles loading and rendering email templates.
 * Replaces placeholders with actual values.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Template directory
const TEMPLATES_DIR = path.join(__dirname, '../templates');

// Default values for placeholders
// Can be overridden via environment variables or options
const DEFAULT_VALUES = {
  BRAND_NAME: process.env.BRAND_NAME || process.env.SES_FROM_NAME || 'SportsArena',
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@sportsarena.com',
  CURRENT_YEAR: new Date().getFullYear().toString()
};

/**
 * Load template file
 * @param {string} templateName - Template file name (without extension)
 * @param {string} extension - File extension ('html' or 'txt')
 * @returns {Promise<string>} Template content
 * @throws {Error} If template file not found
 */
const loadTemplate = async (templateName, extension = 'html') => {
  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.${extension}`);
  
  try {
    const content = await fs.promises.readFile(templatePath, 'utf8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    throw error;
  }
};

/**
 * Replace placeholders in template
 * @param {string} template - Template content
 * @param {Object} values - Values to replace placeholders with
 * @returns {string} Rendered template
 */
const renderTemplate = (template, values = {}) => {
  let rendered = template;

  // Merge default values with provided values
  const allValues = {
    ...DEFAULT_VALUES,
    ...values
  };

  // Replace all placeholders
  for (const [key, value] of Object.entries(allValues)) {
    const placeholder = `{{${key}}}`;
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    rendered = rendered.replace(regex, value || '');
  }

  return rendered;
};

/**
 * Load and render email verification template
 * @param {Object} data - Template data
 * @param {string} data.greeting - Greeting message (e.g., "Hello John,")
 * @param {string} data.verificationCode - 6-digit verification code
 * @param {number} data.expirationMinutes - Expiration time in minutes
 * @param {Object} [options] - Additional options
 * @param {string} [options.brandName] - Brand name (default: "SportsArena")
 * @param {string} [options.supportEmail] - Support email (default: "support@sportsarena.com")
 * @returns {Promise<Object>} Object with html and text versions
 */
const renderEmailVerificationTemplate = async (data, options = {}) => {
  const { greeting, verificationCode, expirationMinutes } = data;
  const { brandName, supportEmail } = options;

  // Prepare template values
  const templateValues = {
    GREETING: greeting || 'Hello,',
    VERIFICATION_CODE: verificationCode,
    EXPIRATION_MINUTES: expirationMinutes.toString(),
    BRAND_NAME: brandName || DEFAULT_VALUES.BRAND_NAME,
    SUPPORT_EMAIL: supportEmail || DEFAULT_VALUES.SUPPORT_EMAIL,
    CURRENT_YEAR: DEFAULT_VALUES.CURRENT_YEAR
  };

  // Load templates
  const [htmlTemplate, textTemplate] = await Promise.all([
    loadTemplate('emailVerification', 'html'),
    loadTemplate('emailVerification', 'txt')
  ]);

  // Render templates
  const html = renderTemplate(htmlTemplate, templateValues);
  const text = renderTemplate(textTemplate, templateValues);

  return {
    html,
    text
  };
};

/**
 * Update default values
 * @param {Object} newDefaults - New default values
 */
const setDefaults = (newDefaults) => {
  Object.assign(DEFAULT_VALUES, newDefaults);
};

module.exports = {
  loadTemplate,
  renderTemplate,
  renderEmailVerificationTemplate,
  setDefaults,
  DEFAULT_VALUES
};

