/**
 * Database Configuration
 * 
 * Supports both DATABASE_URL (for Railway, Heroku, etc.) and individual
 * environment variables (for local development).
 * 
 * Priority:
 * 1. DATABASE_URL (if provided) - used for production platforms
 * 2. Individual variables (DB_USER, DB_HOST, etc.) - used for local development
 */

const { Pool } = require('pg');
require('dotenv').config();

// Determine database configuration
let poolConfig;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (Railway, Heroku, Render, etc.)
  // Format: postgresql://user:password@host:port/database
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    // Enable SSL for production databases (Railway requires this)
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  };
  
  console.log('📦 Using DATABASE_URL for database connection');
} else {
  // Fall back to individual environment variables (local development)
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sportsarena',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
  };
  
  console.log('📦 Using individual DB variables for database connection');
}

const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = { pool };

