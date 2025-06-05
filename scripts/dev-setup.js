#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to development .env file
const devEnvPath = path.join(process.cwd(), '.env');

console.log('Setting up development environment for Cloudflare DynDNS');
console.log('-------------------------------------------------------');
console.log('');

// Check if we already have a valid development environment
if (fs.existsSync(devEnvPath) && fs.existsSync(path.join(process.cwd(), '.dev-mode'))) {
  console.log('Development environment already set up. Using existing configuration.');
  rl.close();
} else {
  // Create development environment if it doesn't exist
  setupDevEnvironment();
}

function setupDevEnvironment() {
  // Ask if the user wants to use mock values or enter real credentials
  rl.question('Do you want to use mock values for development? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      // Use mock values
      const mockConfig = `# DEVELOPMENT CONFIGURATION (MOCK VALUES)
# These values are for development only
API_TOKEN=dev_mock_api_token_1234567890abcdefghijklmnopqrstuvwxyz
ZONE_ID=dev_mock_zone_id_1234567890abcdef
RECORD_ID=dev_mock_record_id_1234567890abcdef
DOMAIN=example.com
SUBDOMAIN=dev
TTL=120
PROXIED=false
RETRY_ATTEMPTS=1
RETRY_DELAY=1000
IP_SERVICES=ipify
`;

      fs.writeFileSync(devEnvPath, mockConfig);
      console.log('\nCreated development .env file with mock values');
      console.log('To use real credentials, edit the .env file or run this script again and choose "n"');

      // Create a last_ip.txt file to prevent initial errors
      const appDataDir = path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'), 'cloudflare-dyndns');
      if (!fs.existsSync(appDataDir)) {
        fs.mkdirSync(appDataDir, { recursive: true });
      }
      fs.writeFileSync(path.join(appDataDir, 'last_ip.txt'), '127.0.0.1');
      console.log('Created mock last_ip.txt file');

      // Create a mock environment flag file
      fs.writeFileSync(path.join(process.cwd(), '.dev-mode'), 'true');
      console.log('Development mode flag created');

      rl.close();
    } else {
      // Prompt for real credentials
      console.log('\nPlease enter your Cloudflare credentials:');
      promptForCredentials();
    }
  });
}

function promptForCredentials() {
  rl.question('Cloudflare API Token: ', (apiToken) => {
    rl.question('Zone ID: ', (zoneId) => {
      rl.question('Record ID: ', (recordId) => {
        rl.question('Domain (e.g., example.com): ', (domain) => {
          rl.question('Subdomain (e.g., vpn): ', (subdomain) => {
            const config = `# DEVELOPMENT CONFIGURATION (REAL CREDENTIALS)
API_TOKEN=${apiToken}
ZONE_ID=${zoneId}
RECORD_ID=${recordId}
DOMAIN=${domain}
SUBDOMAIN=${subdomain}
TTL=120
PROXIED=false
RETRY_ATTEMPTS=1
RETRY_DELAY=1000
`;
            fs.writeFileSync(devEnvPath, config);
            console.log('\nCreated development .env file with your credentials');

            // Create a dev mode flag file
            fs.writeFileSync(path.join(process.cwd(), '.dev-mode'), 'true');
            console.log('Development mode flag created');

            rl.close();
          });
        });
      });
    });
  });
}
