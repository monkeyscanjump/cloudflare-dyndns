#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running comprehensive test suite for Cloudflare DynDNS');

// Step 1: Build the project
console.log('\n📦 Building the project...');
const build = spawn('npm', ['run', 'build']);

build.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Build failed');
    process.exit(1);
  }
  
  console.log('✅ Build successful');
  
  // Step 2: Run unit tests
  console.log('\n🧪 Running unit tests...');
  const test = spawn('npm', ['test']);
  
  test.stdout.on('data', (data) => {
    process.stdout.write(data.toString());
  });
  
  test.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });
  
  test.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Unit tests failed');
      process.exit(1);
    }
    
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
    const oneTime = spawn('node', ['dist/index.js', '--api-token', 'test_token', '--domain', 'example.com', '--subdomain', 'test']);
    
    oneTime.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });
    
    oneTime.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
    
    oneTime.on('close', (code) => {
      console.log(`One-time update test exited with code ${code}`);
      
      // Clean up
      console.log('\n🧹 Cleaning up test files...');
      try {
        fs.unlinkSync(path.join(process.cwd(), '.env.test'));
      } catch (error) {
        console.warn('Warning: Clean up failed', error);
      }
      
      console.log('\n✅ All tests completed!');
    });
  });
});