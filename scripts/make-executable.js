#!/usr/bin/env node
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
