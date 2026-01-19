/**
 * Username Validation Utility
 * 
 * Provides username format validation and reserved words checking
 */

/**
 * Reserved usernames that cannot be used
 * Includes admin, system, and common reserved words
 */
const RESERVED_USERNAMES = [
  // Admin/system accounts
  'admin', 'administrator', 'root', 'system', 'support', 'help', 'info',
  'contact', 'noreply', 'no-reply', 'mail', 'email', 'webmaster',
  
  // Common reserved words
  'api', 'www', 'mail', 'ftp', 'localhost', 'test', 'testing', 'demo',
  'example', 'sample', 'null', 'undefined', 'true', 'false',
  
  // SportsArena specific
  'sportsarena', 'sportarena', 'sports-arena', 'sport-arena',
  'facility', 'facilities', 'court', 'courts', 'booking', 'bookings',
  'player', 'players', 'admin', 'admins', 'moderator', 'moderators',
  
  // Common patterns
  'about', 'contact', 'privacy', 'terms', 'legal', 'blog', 'news',
  'faq', 'help', 'support', 'status', 'health', 'api', 'docs'
];

/**
 * Validate username format
 * @param {string} username - Username to validate
 * @returns {Object} { valid: boolean, error?: string, username?: string }
 */
const validateUsernameFormat = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  // Trim username
  const trimmed = username.trim();

  // Check username is not empty after trimming
  if (!trimmed) {
    return { valid: false, error: 'Username cannot be empty' };
  }

  // Username length validation (minimum 3, maximum 50 characters)
  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Username is too long. Maximum 50 characters allowed' };
  }

  // Username format validation (alphanumeric, underscores, hyphens only)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  // Username cannot start or end with underscore or hyphen
  if (/^[_-]|[_-]$/.test(trimmed)) {
    return { valid: false, error: 'Username cannot start or end with underscore or hyphen' };
  }

  // Username cannot be all numbers
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'Username cannot be all numbers' };
  }

  // Check for reserved usernames (case-insensitive)
  const lowerTrimmed = trimmed.toLowerCase();
  if (RESERVED_USERNAMES.includes(lowerTrimmed)) {
    return { valid: false, error: 'This username is reserved and cannot be used' };
  }

  // Check for reserved patterns (e.g., admin-*, system-*)
  const reservedPatterns = [
    /^admin/i,
    /^system/i,
    /^root/i,
    /^support/i,
    /^help/i,
    /^api/i,
    /^test/i,
    /^demo/i
  ];

  for (const pattern of reservedPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Username cannot start with reserved words (admin, system, root, support, help, api, test, demo)' };
    }
  }

  return { valid: true, username: trimmed };
};

/**
 * Check if username is reserved
 * @param {string} username - Username to check
 * @returns {boolean} True if reserved
 */
const isReservedUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return false;
  }

  const lowerTrimmed = username.trim().toLowerCase();
  return RESERVED_USERNAMES.includes(lowerTrimmed);
};

/**
 * Sanitize and validate username
 * @param {string} username - Username to validate
 * @returns {Object} { valid: boolean, username?: string, error?: string }
 */
const sanitizeAndValidateUsername = (username) => {
  return validateUsernameFormat(username);
};

module.exports = {
  validateUsernameFormat,
  isReservedUsername,
  sanitizeAndValidateUsername,
  RESERVED_USERNAMES
};

