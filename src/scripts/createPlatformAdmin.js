/**
 * Platform Admin Creation Script
 * 
 * Creates a platform admin account with elevated privileges.
 * This script should be run manually by system administrators.
 * 
 * Usage:
 *   node src/scripts/createPlatformAdmin.js <email> <username> <password> <firstName> <lastName> [phone]
 * 
 * Example:
 *   node src/scripts/createPlatformAdmin.js admin@sportsarena.com admin Admin User "Admin" "User" "+1234567890"
 */

require('dotenv').config();
const readline = require('readline');
const User = require('../models/User');
const userService = require('../services/userService');

// Create readline interface for password input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to get password securely
function getPassword(prompt) {
  return new Promise((resolve) => {
    // Temporarily pause readline to use raw mode
    rl.pause();
    
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    const onData = (char) => {
      char = char.toString();

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          // Resume readline
          rl.resume();
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          rl.resume();
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };

    process.stdin.on('data', onData);
  });
}

async function createPlatformAdmin() {
  try {
    console.log('🛡️  Platform Admin Account Creation\n');
    console.log('This script will create a platform administrator account.');
    console.log('Platform admins have elevated privileges to manage global resources.\n');

    // Get user input
    const args = process.argv.slice(2);

    let email, username, password, firstName, lastName, phone;

    if (args.length >= 5) {
      // Command line arguments provided
      email = args[0];
      username = args[1];
      password = args[2];
      firstName = args[3];
      lastName = args[4];
      phone = args[5] || null;
    } else {
      // Interactive mode
      const question = (prompt) => {
        return new Promise((resolve) => {
          rl.question(prompt, resolve);
        });
      };

      email = await question('Email: ');
      username = await question('Username (letters, numbers, underscores, hyphens only, no spaces): ');
      
      // For admin scripts, use visible password input (simpler and more reliable)
      password = await question('Password (min 8 characters, will be visible): ');
      
      firstName = await question('First Name: ');
      lastName = await question('Last Name: ');
      const phoneInput = await question('Phone (optional, press Enter to skip): ');
      phone = phoneInput.trim() || null;
    }

    // Validation
    if (!email || !username || !password || !firstName || !lastName) {
      console.error('❌ Error: Email, username, password, first name, and last name are required.');
      process.exit(1);
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailRegex.test(normalizedEmail)) {
      console.error('❌ Error: Invalid email format.');
      process.exit(1);
    }

    // Validate username format (same rules as signup endpoint)
    const normalizedUsername = username.trim();
    if (normalizedUsername.length < 3) {
      console.error('❌ Error: Username must be at least 3 characters long.');
      process.exit(1);
    }
    if (normalizedUsername.length > 50) {
      console.error('❌ Error: Username is too long. Maximum 50 characters allowed.');
      process.exit(1);
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(normalizedUsername)) {
      console.error('❌ Error: Username can only contain letters, numbers, underscores, and hyphens (no spaces).');
      process.exit(1);
    }
    if (/^[_-]|[_-]$/.test(normalizedUsername)) {
      console.error('❌ Error: Username cannot start or end with underscore or hyphen.');
      process.exit(1);
    }
    if (/^\d+$/.test(normalizedUsername)) {
      console.error('❌ Error: Username cannot be all numbers.');
      process.exit(1);
    }

    // Validate password strength
    if (password.length < 8) {
      console.error('❌ Error: Password must be at least 8 characters long.');
      process.exit(1);
    }

    // Check if email already exists
    const existingUser = await User.findByEmail(normalizedEmail);
    if (existingUser) {
      console.error(`❌ Error: User with email "${normalizedEmail}" already exists.`);
      process.exit(1);
    }

    // Check if username already exists
    const existingUsername = await User.findByUsername(normalizedUsername);
    if (existingUsername) {
      console.error(`❌ Error: Username "${normalizedUsername}" is already taken.`);
      process.exit(1);
    }

    // Create platform admin account
    console.log('\n📝 Creating platform admin account...');
    console.log(`   Email: ${normalizedEmail}`);
    console.log(`   Username: ${normalizedUsername}`);
    console.log(`   Name: ${firstName.trim()} ${lastName.trim()}\n`);
    
    const user = await userService.signup({
      email: normalizedEmail,
      username: normalizedUsername,
      password: password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone ? phone.trim() : null,
      role: 'platform_admin'
    });

    console.log('\n✅ Platform admin account created successfully!\n');
    console.log('Account Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Name: ${user.first_name} ${user.last_name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Created: ${user.created_at}\n`);

    console.log('🔐 Next Steps:');
    console.log('  1. Login using: POST /api/v1/users/login');
    console.log(`  2. Use email: ${user.email}`);
    console.log('  3. Use the JWT token to access platform admin endpoints\n');

  } catch (error) {
    console.error('\n❌ Error creating platform admin account:');
    console.error(`   Message: ${error.message}`);
    console.error('');
    
    if (error.errorCode === 'EMAIL_EXISTS') {
      console.error('   A user with this email already exists.');
    } else if (error.errorCode === 'USERNAME_EXISTS') {
      console.error('   This username is already taken.');
    } else if (error.statusCode) {
      console.error(`   Status Code: ${error.statusCode}`);
    }
    
    // Show full error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('   Full error:', error);
    }
    
    process.exit(1);
  } finally {
    rl.close();
    // Ensure database connection is closed
    try {
      const { pool } = require('../config/database');
      await pool.end();
    } catch (err) {
      // Ignore errors when closing pool
    }
  }
}

// Run script
createPlatformAdmin()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });

