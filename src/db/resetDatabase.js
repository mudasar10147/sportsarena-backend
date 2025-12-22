/**
 * Database Reset Script
 * 
 * WARNING: This will DROP ALL TABLES and data!
 * Only use during development/initial setup.
 * 
 * Run: node src/db/resetDatabase.js
 */

require('dotenv').config();
const { pool } = require('../config/database');

async function resetDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('⚠️  WARNING: This will delete ALL data!');
    console.log('🔄 Resetting database...\n');
    
    // Drop all tables in correct order (respecting foreign keys)
    const dropTables = [
      'DROP TABLE IF EXISTS schema_migrations CASCADE',
      'DROP TABLE IF EXISTS payment_transactions CASCADE',
      'DROP TABLE IF EXISTS bookings CASCADE',
      'DROP TABLE IF EXISTS time_slots CASCADE',
      'DROP TABLE IF EXISTS courts CASCADE',
      'DROP TABLE IF EXISTS facility_sports CASCADE',
      'DROP TABLE IF EXISTS sports CASCADE',
      'DROP TABLE IF EXISTS facilities CASCADE',
      'DROP TABLE IF EXISTS users CASCADE'
    ];

    for (const dropQuery of dropTables) {
      await client.query(dropQuery);
      console.log(`✅ Dropped table: ${dropQuery.match(/IF EXISTS (\w+)/)?.[1] || 'table'}`);
    }

    console.log('\n✨ Database reset complete!');
    console.log('📝 Run "npm run migrate" to recreate all tables.\n');
  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run reset
resetDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Database reset failed:', error);
    process.exit(1);
  });

