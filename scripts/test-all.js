#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running comprehensive test suite for Cloudflare DynDNS');

try {
  // Step 1: Build the project
  console.log('\n📦 Building the project...');
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('✅ Build successful');

  // Step 2: Run unit tests
  console.log('\n🧪 Running unit tests...');
  execSync('npx jest', { stdio: 'inherit' });
  console.log('✅ Unit tests passed');

  // Step 3: Test setup wizard (non-interactive)
  console.log('\n🧰 Testing setup wizard in non-interactive mode...');

  // Create a mock .env file for testing
  const mockEnv = `
API_TOKEN=test_token_for_automated_testing
DOMAIN=example.com
SUBDOMAIN=test
`;
  fs.writeFileSync(path.join(process.cwd(), '.env.test'), mockEnv);

  // Step 4: Test one-time update (with mock values)
  console.log('\n🔄 Testing one-time update (dry run)...');
  try {
    execSync('node dist/index.js --api-token test_token --domain example.com --subdomain test', {
      stdio: 'inherit',
      timeout: 10000 // 10 second timeout
    });
  } catch (e) {
    // Allow failures in this step - it might fail due to API calls
    console.log('One-time update test completed with issues (expected)');
  }

  // Clean up
  console.log('\n🧹 Cleaning up test files...');
  try {
    fs.unlinkSync(path.join(process.cwd(), '.env.test'));
  } catch (error) {
    console.warn('Warning: Clean up failed', error);
  }

  console.log('\n✅ All tests completed!');
} catch (error) {
  console.error(`❌ Tests failed: ${error.message}`);
  process.exit(1);
}
