/**
 * Migration Script: Make time_slot_id nullable
 * 
 * This script makes the time_slot_id column nullable to allow the new booking system
 * to work without requiring time_slot_id.
 * 
 * Run with: node run-migration.js
 * Or on Railway: railway run node run-migration.js
 */

const { pool } = require('./src/config/database');

async function runMigration() {
  console.log('🔄 Starting migration: Make time_slot_id nullable...');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('✅ Transaction started');
    
    // Step 1: Drop foreign key constraint if it exists
    console.log('📝 Step 1: Dropping foreign key constraint...');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 
          FROM information_schema.table_constraints 
          WHERE constraint_name = 'bookings_time_slot_id_fkey'
          AND table_name = 'bookings'
        ) THEN
          ALTER TABLE bookings DROP CONSTRAINT bookings_time_slot_id_fkey;
          RAISE NOTICE 'Foreign key constraint dropped';
        ELSE
          RAISE NOTICE 'Foreign key constraint does not exist';
        END IF;
      END $$;
    `);
    console.log('✅ Foreign key constraint handled');
    
    // Step 2: Make time_slot_id nullable
    console.log('📝 Step 2: Making time_slot_id nullable...');
    await client.query(`
      ALTER TABLE bookings 
      ALTER COLUMN time_slot_id DROP NOT NULL;
    `);
    console.log('✅ time_slot_id is now nullable');
    
    // Step 3: Verify the change
    console.log('📝 Step 3: Verifying changes...');
    const result = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'time_slot_id';
    `);
    
    if (result.rows.length > 0) {
      const column = result.rows[0];
      console.log(`✅ Verification: time_slot_id is_nullable = ${column.is_nullable}`);
      
      if (column.is_nullable === 'YES') {
        console.log('✅ Migration completed successfully!');
      } else {
        throw new Error('Migration failed: time_slot_id is still NOT NULL');
      }
    } else {
      throw new Error('Migration failed: time_slot_id column not found');
    }
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('📋 Error details:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });

