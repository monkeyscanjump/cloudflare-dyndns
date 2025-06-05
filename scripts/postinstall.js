#!/usr/bin/env node
const utils = require('./utils');

console.log('Running post-installation setup for cloudflare-dyndns...');

// Ensure dist/scripts directory exists (needed for TypeScript output)
utils.ensureDistScriptsDir();

// Check if this is running after a global install
if (utils.isGlobalInstall()) {
  console.log('Global installation detected');

  // Create the global config directory
  if (utils.ensureGlobalConfigDir()) {
    utils.copyEnvExample();
  }
}

console.log('Post-installation completed successfully!');
