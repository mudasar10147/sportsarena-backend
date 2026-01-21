/**
 * Application Startup Script
 * 
 * Runs database migrations before starting the server.
 * Used for production deployments (Railway, Heroku, etc.)
 * 
 * This ensures the database schema is always up-to-date before
 * the server starts accepting requests.
 */

require('dotenv').config();
const { pool, testConnection } = require('./config/database');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'db', 'migrations');

// Migration files in order (must match runMigrations.js)
const migrationFiles = [
  '001_create_users_table.sql',
  '002_create_facilities_table.sql',
  '003_create_sports_table.sql',
  '004_create_facility_sports_table.sql',
  '005_create_courts_table.sql',
  '007_create_bookings_table.sql',
  '008_create_payment_transactions_table.sql',
  '010_add_platform_admin_role.sql',
  '011_add_rejected_status_to_bookings.sql',
  '012_create_images_table.sql',
  '013_add_upload_fields_to_images.sql',
  '014_add_moderation_and_soft_delete.sql',
  '015_add_google_auth_support.sql',
  '016_add_time_normalization_helpers.sql',
  '017_create_court_availability_rules.sql',
  '018_create_booking_policies.sql',
  '019_create_blocked_time_ranges.sql',
  '020_update_bookings_table_structure.sql',
  '021_add_booking_expiration.sql',
  '022_add_pending_expiration_to_policies.sql',
  '025_make_time_slot_id_nullable.sql',
  '023_remove_time_slot_id_from_bookings.sql',
  '024_add_payment_proof_to_bookings.sql',
  '026_create_email_verification_codes_table.sql',
  '027_add_signup_status_to_users.sql',
  '028_add_username_to_email_verification_codes.sql',
  '029_add_facility_cover_and_amenities.sql'
];

/**
 * Run database migrations
 * Idempotent - skips already executed migrations
 */
async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migrations...\n');
    
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    let migrationsRun = 0;

    for (const filename of migrationFiles) {
      const filePath = path.join(migrationsDir, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${filename} - file not found`);
        continue;
      }

      // Check if migration already ran
      const checkResult = await client.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipping ${filename} - already executed`);
        continue;
      }

      // Read and execute migration
      console.log(`📄 Running ${filename}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`✅ Successfully executed ${filename}\n`);
        migrationsRun++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    if (migrationsRun === 0) {
      console.log('✨ Database is up-to-date (no new migrations)\n');
    } else {
      console.log(`✨ ${migrationsRun} migration(s) completed successfully!\n`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Start the application
 */
async function start() {
  try {
    // Test database connection first
    console.log('🔍 Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection test failed. Cannot proceed with migrations.');
    }
    console.log('✅ Database connection test passed\n');
    
    // Run migrations
    await runMigrations();
    
    // Then start the server
    console.log('🚀 Starting server...\n');
    require('./server');
  } catch (error) {
    console.error('💥 Startup failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting:');
      console.error('   - For Railway: Ensure PostgreSQL service is added and DATABASE_URL is set');
      console.error('   - For local: Ensure PostgreSQL is running and DB_* variables are set');
      console.error('   - Check Railway logs for DATABASE_URL value');
    }
    process.exit(1);
  }
}

// Start the application
start();

