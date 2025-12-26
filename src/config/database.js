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

// Check for DATABASE_URL (Railway, Heroku, Render, etc.)
// Railway automatically sets this when you add a PostgreSQL service
const databaseUrl = process.env.DATABASE_URL || 
                     process.env.POSTGRES_URL || 
                     process.env.PG_CONNECTION_STRING;

if (databaseUrl) {
  // Use DATABASE_URL if provided (Railway, Heroku, Render, etc.)
  // Format: postgresql://user:password@host:port/database
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.RAILWAY_ENVIRONMENT === 'production';
  
  poolConfig = {
    connectionString: databaseUrl,
    // Enable SSL for production databases (Railway requires this)
    ssl: isProduction ? {
      rejectUnauthorized: false
    } : false
  };
  
  console.log('📦 Using DATABASE_URL for database connection');
  if (isProduction) {
    console.log('🔒 SSL enabled for production database');
  }
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
  console.log(`   Host: ${poolConfig.host}, Database: ${poolConfig.database}`);
}

const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  // Don't exit immediately - let the application handle it
  // process.exit(-1);
});

// Helper function to test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   → Connection refused. Check:');
      console.error('     1. Database server is running');
      console.error('     2. DATABASE_URL is set correctly (for Railway/production)');
      console.error('     3. DB_HOST, DB_PORT, etc. are correct (for local development)');
    }
    return false;
  }
}

module.exports = { pool, testConnection };

