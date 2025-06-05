#!/usr/bin/env node
import { DynDnsApp } from './app/DynDnsApp';
import { CommandLineArgs, IConfig } from './types';
import { version } from '../package.json';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Checks if running in development mode by looking for .dev-mode file
 */
const isDevelopmentMode = fs.existsSync(path.join(process.cwd(), '.dev-mode'));

/**
 * Processes command line arguments into a structured object
 */
const args = process.argv.slice(2);
const cliArgs: CommandLineArgs = {
  help: args.includes('--help') || args.includes('-h'),
  version: args.includes('--version') || args.includes('-v'),
  continuous: args.includes('--continuous') || args.includes('-c'),
  setup: args.includes('--setup'),
  debug: args.includes('--debug')
};

// Configure development mode environment
if (isDevelopmentMode && cliArgs.debug) {
  console.log('🔧 Running in DEVELOPMENT MODE');
  process.env.DEVELOPMENT_MODE = 'true';
}

/**
 * Extracts a value for a command line argument key
 * @param key Argument key to find
 * @returns Value following the key or undefined if not found
 */
function getArgValue(key: string): string | undefined {
  const index = args.indexOf(key);
  return (index !== -1 && index < args.length - 1) ? args[index + 1] : undefined;
}

/**
 * Parse direct configuration parameters from command line arguments
 */
const directConfig: Partial<IConfig> = {
  API_TOKEN: getArgValue('--api-token'),
  ZONE_ID: getArgValue('--zone-id'),
  RECORD_ID: getArgValue('--record-id'),
  DOMAIN: getArgValue('--domain'),
  SUBDOMAIN: getArgValue('--subdomain')
};

// Parse optional parameters
if (getArgValue('--ttl')) {
  directConfig.TTL = parseInt(getArgValue('--ttl') || '120', 10);
}
if (args.includes('--proxied')) {
  directConfig.PROXIED = true;
}

// Show help text
if (cliArgs.help) {
  console.log(`
Cloudflare DynDNS - Update Cloudflare DNS with your dynamic IP address

Usage:
  cloudflare-dyndns [options]

Options:
  -c, --continuous       Run in continuous monitoring mode (recommended)
  -h, --help             Show this help message
  -v, --version          Show version information
  --setup                Run the setup wizard
  --debug                Enable debug logging

Direct Configuration:
  --api-token <token>    Cloudflare API token
  --zone-id <id>         Cloudflare Zone ID
  --record-id <id>       DNS Record ID
  --domain <domain>      Domain name
  --subdomain <subdomain> Subdomain
  --ttl <seconds>        TTL in seconds (minimum 60)
  --proxied              Enable Cloudflare proxy (default: false)

Examples:
  cloudflare-dyndns                  Run once and exit
  cloudflare-dyndns --continuous     Run continuously with adaptive intervals
  cloudflare-dyndns --api-token xxx --zone-id yyy --record-id zzz --domain example.com --subdomain vpn
  `);
  process.exit(0);
}

// Show version
if (cliArgs.version) {
  console.log(`Cloudflare DynDNS v${version}`);
  process.exit(0);
}

/**
 * Launches the setup wizard if requested
 */
if (cliArgs.setup) {
  const setupScriptPath = path.join(__dirname, 'scripts', 'setup.js');

  if (fs.existsSync(setupScriptPath)) {
    console.log('Launching setup wizard...');

    try {
      require('./scripts/setup');
      // The setup script will call process.exit() when done
    } catch (error) {
      console.error(`Error running setup script: ${(error as Error).message}`);
      console.log(`\nPlease run 'cloudflare-dyndns-setup' instead.`);
      process.exit(1);
    }
  } else {
    console.error(`Setup script not found at ${setupScriptPath}`);
    console.log(`\nPlease run 'cloudflare-dyndns-setup' instead.`);
    process.exit(1);
  }
}

/**
 * Main application function that runs the DynDNS update process
 * @param options Configuration options
 * @param options.continuous Whether to run in continuous monitoring mode
 * @param options.config Direct configuration overrides
 * @param options.debug Whether to enable debug mode
 * @returns Promise resolving to true if successful, false otherwise
 */
export const runDynDns = async (
  options: {
    continuous?: boolean;
    config?: Partial<IConfig>;
    debug?: boolean;
  } = {}
): Promise<boolean> => {
  const app = new DynDnsApp(options.config || {}, options.debug || false);

  try {
    if (app.needsSetup()) {
      console.error('Configuration is missing or incomplete. Please run cloudflare-dyndns-setup first or provide configuration.');
      return false;
    }

    if (options.continuous) {
      console.log('Starting Cloudflare DynDNS in continuous monitoring mode...');
      await app.startMonitoring();
      return true; // This will never actually return if continuous mode is successful
    } else {
      console.log('Running Cloudflare DynDNS once...');
      return await app.runOnce();
    }
  } catch (error) {
    console.error(`Fatal error: ${(error as Error).message}`);
    return false;
  }
};

// Only execute this if running as a script, not when imported as a module
if (require.main === module) {
  (async () => {
    const success = await runDynDns({
      continuous: cliArgs.continuous,
      config: Object.keys(directConfig).length > 0 ? directConfig : undefined,
      debug: cliArgs.debug
    });

    if (!cliArgs.continuous) {
      process.exit(success ? 0 : 1);
    }
  })();
}
