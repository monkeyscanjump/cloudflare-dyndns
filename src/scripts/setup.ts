#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompts the user with a question and returns their answer
 * @param question Text to display to the user
 * @returns User's response as a string
 */
async function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Returns all possible configuration file locations across different platforms
 * @returns Array of possible configuration file paths
 */
function findConfigLocations(): string[] {
  return [
    path.join(process.cwd(), '.env'),
    path.join(os.homedir(), '.cloudflare-dyndns', '.env'),
    ...(process.platform === 'win32'
        ? [path.join(process.env.ProgramData || 'C:\\ProgramData', 'cloudflare-dyndns', '.env')]
        : ['/etc/cloudflare-dyndns/.env'])
  ];
}

/**
 * Interactive setup wizard for configuring the Cloudflare DynDNS application
 * Handles both creating new configurations and editing existing ones
 */
async function setupConfig(): Promise<void> {
  console.log('Cloudflare DynDNS Setup');
  console.log('=======================');
  console.log('This wizard will help you set up the configuration for Cloudflare DynDNS.\n');

  const configLocations = findConfigLocations();
  let existingConfigs = configLocations.filter(loc => fs.existsSync(loc));
  let overwriteChoice = 'new';

  if (existingConfigs.length > 0) {
    console.log('Existing configuration files found:');
    existingConfigs.forEach((loc, idx) => {
      console.log(`  ${idx + 1}. ${loc}`);
    });

    overwriteChoice = await promptUser('\nDo you want to create a new configuration or edit an existing one? (new/edit): ');

    if (overwriteChoice.toLowerCase() === 'edit') {
      let fileToEdit = '';

      if (existingConfigs.length === 1) {
        fileToEdit = existingConfigs[0];
      } else {
        const fileChoice = await promptUser(`Enter the number of the file to edit (1-${existingConfigs.length}): `);
        const fileIndex = parseInt(fileChoice, 10) - 1;

        if (fileIndex >= 0 && fileIndex < existingConfigs.length) {
          fileToEdit = existingConfigs[fileIndex];
        } else {
          console.log('Invalid choice. Creating a new configuration.');
        }
      }

      if (fileToEdit) {
        // Parse existing config
        const existingConfig = fs.readFileSync(fileToEdit, 'utf8');
        const configMap = new Map();

        existingConfig.split('\n').forEach(line => {
          if (line && !line.startsWith('#')) {
            const parts = line.split('=');
            if (parts.length === 2) {
              configMap.set(parts[0].trim(), parts[1].trim());
            }
          }
        });

        // Update with prompts, showing current values
        const apiToken = await promptUser(`Cloudflare API Token [${configMap.get('API_TOKEN') || ''}]: `);
        const zoneId = await promptUser(`Cloudflare Zone ID (leave blank to auto-detect) [${configMap.get('ZONE_ID') || ''}]: `);
        const recordId = await promptUser(`DNS Record ID (leave blank to auto-detect) [${configMap.get('RECORD_ID') || ''}]: `);
        const domain = await promptUser(`Domain (e.g., example.com) [${configMap.get('DOMAIN') || ''}]: `);
        const subdomain = await promptUser(`Subdomain (e.g., wireguard) [${configMap.get('SUBDOMAIN') || ''}]: `);

        // Update config map with new values (or keep old if empty)
        if (apiToken) configMap.set('API_TOKEN', apiToken);
        if (zoneId) configMap.set('ZONE_ID', zoneId);
        if (recordId) configMap.set('RECORD_ID', recordId);
        if (domain) configMap.set('DOMAIN', domain);
        if (subdomain) configMap.set('SUBDOMAIN', subdomain);

        // Build updated config
        let updatedConfig = '';
        for (const [key, value] of configMap.entries()) {
          updatedConfig += `${key}=${value}\n`;
        }

        // Write back to file
        try {
          fs.writeFileSync(fileToEdit, updatedConfig);
          console.log(`\nConfiguration updated at: ${fileToEdit}`);
          rl.close();
          return;
        } catch (error) {
          console.error(`Error writing to ${fileToEdit}:`, error);
          console.log('Trying to create a new configuration instead...');
        }
      }
    }
  }

  // Determine where to save the new config
  let configDir: string;
  let configFile: string;

  // Choose appropriate location based on installation type
  if (process.env.npm_config_global === 'true') {
    configDir = path.join(os.homedir(), '.cloudflare-dyndns');
    configFile = path.join(configDir, '.env');
  } else {
    configDir = process.cwd();
    configFile = path.join(configDir, '.env');
  }

  // Create directory if needed
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Created configuration directory: ${configDir}`);
    } catch (error) {
      console.error(`Error creating directory ${configDir}:`, error);
      configDir = process.cwd();
      configFile = path.join(configDir, '.env');
      console.log(`Falling back to current directory: ${configDir}`);
    }
  }

  // Prompt for configuration values
  console.log('\nEnter your Cloudflare configuration:');
  console.log('(Only API Token is required, other values can be auto-detected)');

  const apiToken = await promptUser('Cloudflare API Token: ');

  console.log('\nThe following values can be auto-detected in most cases. Leave blank to auto-detect:');
  const zoneId = await promptUser('Cloudflare Zone ID (optional): ');
  const recordId = await promptUser('DNS Record ID (optional): ');

  console.log('\nIf you leave these blank, the program will try to find a suitable DNS record to update:');
  const domain = await promptUser('Domain (e.g., example.com): ');
  const subdomain = await promptUser('Subdomain (e.g., wireguard): ');

  console.log('\nAdditional options (press Enter to use defaults):');
  const ttl = await promptUser('TTL in seconds (default: 120): ') || '120';
  const proxied = await promptUser('Enable Cloudflare proxy? (true/false, default: false): ') || 'false';

  // Create the configuration file
  const configContent = `# Cloudflare API credentials
API_TOKEN=${apiToken}

# Cloudflare zone and record identifiers
${zoneId ? `ZONE_ID=${zoneId}` : '# ZONE_ID will be auto-detected'}
${recordId ? `RECORD_ID=${recordId}` : '# RECORD_ID will be auto-detected'}

# Domain configuration
${domain ? `DOMAIN=${domain}` : '# DOMAIN will be extracted from detected record'}
${subdomain ? `SUBDOMAIN=${subdomain}` : '# SUBDOMAIN will be extracted from detected record'}

# Optional configuration
TTL=${ttl}
PROXIED=${proxied}
RETRY_ATTEMPTS=3
RETRY_DELAY=5000
IP_SERVICES=ipify,ifconfig,ipinfo,seeip

# Continuous monitoring settings
CHECK_INTERVAL=60000
ADAPTIVE_INTERVAL=true
`;

  try {
    fs.writeFileSync(configFile, configContent);
    console.log(`\nConfiguration file created at: ${configFile}`);

    if (fs.existsSync(configFile)) {
      try {
        // Secure the config file (contains API tokens)
        if (process.platform !== 'win32') {
          fs.chmodSync(configFile, 0o600);
        }
      } catch (error) {
        console.warn('Warning: Could not set secure permissions on config file:', error);
      }
    }

    console.log('\nYou can now run "cloudflare-dyndns" to update your DNS record once,');
    console.log('or "cloudflare-dyndns --continuous" to run in continuous monitoring mode.');

    if (!zoneId || !recordId) {
      console.log('\nNOTE: Since you opted for auto-detection, the first run may take longer');
      console.log('as the program discovers your Cloudflare zones and records.');
    }

  } catch (error) {
    console.error('Error creating configuration file:', error);
    process.exit(1);
  }

  rl.close();
}

setupConfig().catch(error => {
  console.error('Error during setup:', error);
  process.exit(1);
});
