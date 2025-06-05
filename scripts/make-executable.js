#!/usr/bin/env node

/**
 * Script that sets executable permissions for the cloudflare-dyndns application
 * Also creates configuration directory for global installations
 *
 * @module make-executable
 */
const utils = require('./utils');

console.log('Setting executable permissions for cloudflare-dyndns...');

// Make scripts executable on Unix systems
utils.makeScriptsExecutable();

// Create global config directory if this is a global installation
if (utils.isGlobalInstall()) {
  if (utils.ensureGlobalConfigDir()) {
    utils.copyEnvExample();
  }
}

console.log('\nSetup completed successfully!');
