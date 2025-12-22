/**
 * AWS S3 Configuration
 * 
 * Configures AWS S3 client for image uploads.
 * Uses environment variables for credentials and configuration.
 * 
 * Required Environment Variables:
 * - AWS_ACCESS_KEY_ID: AWS access key
 * - AWS_SECRET_ACCESS_KEY: AWS secret key
 * - AWS_REGION: AWS region (e.g., 'us-east-1')
 * - S3_BUCKET_NAME: S3 bucket name (e.g., 'sportsarena-images-prod')
 * 
 * Optional Environment Variables:
 * - CDN_BASE_URL: CloudFront distribution URL (e.g., 'https://cdn.example.com')
 *                 If not set, falls back to direct S3 URLs
 * 
 * Security:
 * - Credentials are loaded from environment variables (never hardcoded)
 * - Bucket access remains private
 * - Pre-signed URLs provide temporary, scoped access
 */

require('dotenv').config();
const { S3Client } = require('@aws-sdk/client-s3');

// Validate required environment variables
const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'S3_BUCKET_NAME'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️  Warning: Missing AWS S3 environment variables: ${missingVars.join(', ')}`);
  console.warn('   S3 upload functionality will not work until these are configured.');
}

// AWS S3 Client Configuration
// Disable automatic checksums for pre-signed URLs to avoid signature mismatches
// Checksums are SDK-internal parameters that shouldn't be in pre-signed URLs for client uploads
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  },
  // Disable request checksum calculation to prevent SDK from adding checksum query parameters
  requestChecksumCalculation: 'DISABLED',
  // Disable response checksum validation for consistency
  responseChecksumValidation: 'DISABLED'
});

// S3 Bucket Configuration
// Support both S3_BUCKET_NAME (preferred) and AWS_S3_BUCKET (backward compatibility)
const S3_BUCKET = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

// CDN Configuration (CloudFront)
// CDN_BASE_URL is REQUIRED for production - images are served via CDN
// Format: https://d1234567890abc.cloudfront.net or https://cdn.example.com
const CDN_BASE_URL = process.env.CDN_BASE_URL;

// Validate CDN_BASE_URL format
if (!CDN_BASE_URL) {
  console.error('❌ ERROR: CDN_BASE_URL environment variable is required');
  console.error('   Please set CDN_BASE_URL in your .env file');
  console.error('   Example: CDN_BASE_URL=https://d1234567890abc.cloudfront.net');
  process.exit(1);
}

// Normalize CDN_BASE_URL: add https:// if missing, remove trailing slash
let normalizedCdnBaseUrl = CDN_BASE_URL.trim();
if (!normalizedCdnBaseUrl.startsWith('http://') && !normalizedCdnBaseUrl.startsWith('https://')) {
  // Auto-add https:// if protocol is missing
  normalizedCdnBaseUrl = `https://${normalizedCdnBaseUrl}`;
}
if (normalizedCdnBaseUrl.endsWith('/')) {
  normalizedCdnBaseUrl = normalizedCdnBaseUrl.slice(0, -1);
}

// Validate CDN_BASE_URL format (must be a valid URL after normalization)
// Allow: https://domain.com, https://subdomain.domain.com, https://d123.cloudfront.net
const urlPattern = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*(:\d+)?$/;
if (!urlPattern.test(normalizedCdnBaseUrl)) {
  console.error('❌ ERROR: CDN_BASE_URL must be a valid URL or domain name');
  console.error(`   Current value: ${CDN_BASE_URL}`);
  console.error(`   Normalized value: ${normalizedCdnBaseUrl}`);
  console.error('   Example: CDN_BASE_URL=https://d1234567890abc.cloudfront.net');
  console.error('   Or: CDN_BASE_URL=d3s74c2mbhezp6.cloudfront.net (https:// will be added automatically)');
  process.exit(1);
}

// Image upload configuration
const IMAGE_UPLOAD_CONFIG = {
  // Maximum file size: 5MB (in bytes)
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Allowed MIME types
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp'
  ],
  
  // Pre-signed URL expiry time (seconds)
  PRESIGNED_URL_EXPIRY: 300, // 5 minutes
  
  // Default image format (for S3 key generation)
  DEFAULT_FORMAT: 'webp'
};

// Image variant configuration
// Defines available image variants and their specifications
const IMAGE_VARIANTS = {
  thumb: {
    maxWidth: 300,
    quality: 75,
    description: 'Thumbnails, avatars, small previews'
  },
  medium: {
    maxWidth: 800,
    quality: 80,
    description: 'Cards, lists, medium-sized displays'
  },
  full: {
    maxWidth: 1600,
    quality: 85,
    description: 'Full-width displays, detail views'
  }
};

// Valid variant names
const VALID_VARIANTS = Object.keys(IMAGE_VARIANTS);

/**
 * Generate S3 object key for an image
 * Format: {entity_type}/{entity_id}/{image_id}.{extension}
 * 
 * @param {string} entityType - Entity type (user, facility, court, etc.)
 * @param {number} entityId - Entity ID
 * @param {string} imageId - Image UUID
 * @param {string} contentType - MIME type (e.g., 'image/jpeg')
 * @returns {string} S3 object key
 */
const generateS3Key = (entityType, entityId, imageId, contentType) => {
  // Determine file extension from content type
  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  
  const extension = extensionMap[contentType] || IMAGE_UPLOAD_CONFIG.DEFAULT_FORMAT;
  
  // Format: {entity_type}/{entity_id}/{image_id}.{extension}
  return `${entityType}/${entityId}/${imageId}.${extension}`;
};

/**
 * Generate full S3 URL for an image
 * 
 * @param {string} s3Key - S3 object key
 * @returns {string} Full S3 URL
 */
const generateS3Url = (s3Key) => {
  if (!S3_BUCKET) {
    return null;
  }
  
  // Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
};

/**
 * Generate public CDN URL for an image
 * 
 * Generates CDN URL using CDN_BASE_URL environment variable.
 * Database stores only S3 keys, URLs are generated dynamically.
 * 
 * @param {string} s3Key - S3 object key (e.g., 'facility/1/550e8400-e29b-41d4-a716-446655440000.jpg')
 * @returns {string|null} Public CDN URL or null if s3Key is missing
 * 
 * @example
 * getPublicImageUrl('facility/1/image.jpg')
 * // Returns: 'https://d1234567890abc.cloudfront.net/facility/1/image.jpg'
 */
const getPublicImageUrl = (s3Key) => {
  if (!s3Key) {
    return null;
  }

  // Remove leading slash from s3Key if present
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  
  // Generate CDN URL: CDN_BASE_URL + '/' + s3Key
  const cdnUrl = `${normalizedCdnBaseUrl}/${cleanKey}`;
  
  // Log in debug mode (if DEBUG environment variable is set)
  if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
    console.log(`[CDN] Generated URL for s3Key "${s3Key}": ${cdnUrl}`);
  }
  
  return cdnUrl;
};

/**
 * Generate S3 key for an image variant
 * 
 * Variant naming convention: {base_key}_{variant}.{extension}
 * 
 * @param {string} originalS3Key - Original S3 key (e.g., 'facility/1/image.webp')
 * @param {string} variant - Variant name ('thumb', 'medium', 'full')
 * @returns {string|null} Variant S3 key or null if invalid
 * 
 * @example
 * generateVariantS3Key('facility/1/image.webp', 'thumb')
 * // Returns: 'facility/1/image_thumb.webp'
 */
const generateVariantS3Key = (originalS3Key, variant) => {
  if (!originalS3Key || !variant) {
    return null;
  }

  // Validate variant name
  if (!VALID_VARIANTS.includes(variant)) {
    console.warn(`Invalid variant name: ${variant}. Valid variants: ${VALID_VARIANTS.join(', ')}`);
    return null;
  }

  // Extract extension from original key
  const lastDotIndex = originalS3Key.lastIndexOf('.');
  if (lastDotIndex === -1) {
    // No extension found, return null
    return null;
  }

  const baseKey = originalS3Key.substring(0, lastDotIndex);
  const extension = originalS3Key.substring(lastDotIndex + 1);

  // Format: {base_key}_{variant}.{extension}
  return `${baseKey}_${variant}.${extension}`;
};

/**
 * Generate public CDN URL for an image variant
 * 
 * @param {string} originalS3Key - Original S3 key
 * @param {string} variant - Variant name ('thumb', 'medium', 'full')
 * @returns {string|null} Public CDN URL for variant, or null if invalid
 * 
 * @example
 * getVariantImageUrl('facility/1/image.webp', 'medium')
 * // Returns: 'https://cdn.sportsarena.com/facility/1/image_medium.webp'
 */
const getVariantImageUrl = (originalS3Key, variant) => {
  const variantS3Key = generateVariantS3Key(originalS3Key, variant);
  if (!variantS3Key) {
    return null;
  }

  return getPublicImageUrl(variantS3Key);
};

/**
 * Generate all variant URLs for an image
 * 
 * @param {string} originalS3Key - Original S3 key
 * @returns {Object} Object with variant names as keys and URLs as values
 * 
 * @example
 * getAllVariantUrls('facility/1/image.webp')
 * // Returns: {
 * //   thumb: 'https://cdn.sportsarena.com/facility/1/image_thumb.webp',
 * //   medium: 'https://cdn.sportsarena.com/facility/1/image_medium.webp',
 * //   full: 'https://cdn.sportsarena.com/facility/1/image_full.webp'
 * // }
 */
const getAllVariantUrls = (originalS3Key) => {
  if (!originalS3Key) {
    return {
      thumb: null,
      medium: null,
      full: null
    };
  }

  return {
    thumb: getVariantImageUrl(originalS3Key, 'thumb'),
    medium: getVariantImageUrl(originalS3Key, 'medium'),
    full: getVariantImageUrl(originalS3Key, 'full')
  };
};

module.exports = {
  s3Client,
  S3_BUCKET,
  S3_REGION,
  CDN_BASE_URL: normalizedCdnBaseUrl, // Export normalized version
  IMAGE_UPLOAD_CONFIG,
  IMAGE_VARIANTS,
  VALID_VARIANTS,
  generateS3Key,
  generateS3Url, // Keep for internal use (pre-signed URLs, etc.)
  getPublicImageUrl,
  generateVariantS3Key,
  getVariantImageUrl,
  getAllVariantUrls
};

