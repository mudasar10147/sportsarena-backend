/**
 * Email Verification Test Helper
 * 
 * Simple script to test email verification functionality manually
 * Run with: node test-email-verification.js
 */

require('dotenv').config();
const emailVerificationService = require('./src/services/emailVerificationService');
const { sanitizeAndValidateEmail, sanitizeAndValidateCode } = require('./src/utils/validation');

// Test configuration
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_CODE = process.env.TEST_CODE || '123456';

async function runTests() {
  console.log('🧪 Email Verification Test Helper\n');
  console.log('=' .repeat(50));

  // Test 1: Code Generation
  console.log('\n📝 Test 1: Code Generation');
  try {
    const code1 = emailVerificationService.generateVerificationCode();
    const code2 = emailVerificationService.generateVerificationCode();
    console.log(`✅ Generated code 1: ${code1}`);
    console.log(`✅ Generated code 2: ${code2}`);
    console.log(`✅ Code format valid: ${/^\d{6}$/.test(code1)}`);
    console.log(`✅ Codes are different: ${code1 !== code2}`);
  } catch (error) {
    console.error(`❌ Code generation failed: ${error.message}`);
  }

  // Test 2: Code Hashing
  console.log('\n🔐 Test 2: Code Hashing');
  try {
    const code = '123456';
    const hash = await emailVerificationService.hashCode(code);
    const isValid = await emailVerificationService.verifyCodeHash(code, hash);
    const isInvalid = await emailVerificationService.verifyCodeHash('000000', hash);
    
    console.log(`✅ Code hashed: ${hash.substring(0, 20)}...`);
    console.log(`✅ Valid code verification: ${isValid}`);
    console.log(`✅ Invalid code rejection: ${!isInvalid}`);
  } catch (error) {
    console.error(`❌ Code hashing failed: ${error.message}`);
  }

  // Test 3: Email Validation
  console.log('\n📧 Test 3: Email Validation');
  try {
    const validEmail = sanitizeAndValidateEmail('TEST@EXAMPLE.COM');
    const invalidEmail = sanitizeAndValidateEmail('invalid-email');
    
    console.log(`✅ Valid email: ${validEmail.valid} (${validEmail.email || validEmail.error})`);
    console.log(`✅ Invalid email rejected: ${!invalidEmail.valid}`);
  } catch (error) {
    console.error(`❌ Email validation failed: ${error.message}`);
  }

  // Test 4: Code Validation
  console.log('\n🔢 Test 4: Code Validation');
  try {
    const validCode = sanitizeAndValidateCode('123456');
    const invalidCode = sanitizeAndValidateCode('12345');
    const sanitizedCode = sanitizeAndValidateCode(' 123 456 ');
    
    console.log(`✅ Valid code: ${validCode.valid} (${validCode.code || validCode.error})`);
    console.log(`✅ Invalid code rejected: ${!invalidCode.valid}`);
    console.log(`✅ Code sanitization: "${sanitizedCode.code}" (whitespace removed)`);
  } catch (error) {
    console.error(`❌ Code validation failed: ${error.message}`);
  }

  // Test 5: Cleanup Function
  console.log('\n🧹 Test 5: Cleanup Function');
  try {
    const result = await emailVerificationService.cleanupExpiredCodes(24);
    console.log(`✅ Cleanup executed: ${result.deletedCount} codes deleted`);
    console.log(`✅ Cleanup age: ${result.olderThanHours} hours`);
  } catch (error) {
    console.error(`❌ Cleanup failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Basic tests completed!');
  console.log('\n📋 For full testing, use MANUAL_TESTING_CHECKLIST.md');
  console.log('📚 For testing strategy, see TESTING_STRATEGY.md\n');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

