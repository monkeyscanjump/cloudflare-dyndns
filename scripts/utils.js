const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Utility functions for install scripts
 */
const scriptUtils = {
  /**
   * Check if this is a global installation
   */
  isGlobalInstall: () => {
    return process.env.npm_config_global === 'true';
  },

  /**
   * Get the global config directory path
   */
  getGlobalConfigDir: () => {
    return path.join(os.homedir(), '.cloudflare-dyndns');
  },

  /**
   * Create the global config directory if it doesn't exist
   */
  ensureGlobalConfigDir: () => {
    const configDir = scriptUtils.getGlobalConfigDir();

    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
        console.log(`Created global configuration directory at ${configDir}`);
        return true;
      } catch (error) {
        console.error(`Failed to create global config directory: ${error.message}`);
        return false;
      }
    }
    return true;
  },

  /**
   * Copy the env.example file to the global config directory
   */
  copyEnvExample: () => {
    const configDir = scriptUtils.getGlobalConfigDir();
    const envExample = path.join(__dirname, '..', '.env.example');
    const envTarget = path.join(configDir, '.env.example');

    if (fs.existsSync(envExample)) {
      try {
        fs.copyFileSync(envExample, envTarget);
        console.log(`Copied .env.example to ${envTarget}`);
        console.log('\nTo configure the application, run:');
        console.log('  cloudflare-dyndns-setup');
        return true;
      } catch (error) {
        console.error(`Failed to copy .env.example: ${error.message}`);
        return false;
      }
    } else {
      console.warn(`Warning: .env.example not found at ${envExample}`);
      return false;
    }
  },

  /**
   * Make scripts executable on Unix systems
   */
  makeScriptsExecutable: () => {
    if (os.platform() === 'win32') {
      return true; // Not needed on Windows
    }

    try {
      const binaries = [
        path.join(__dirname, '..', 'dist', 'index.js'),
        path.join(__dirname, '..', 'dist', 'scripts', 'setup.js')
      ];

      let allSuccessful = true;
      binaries.forEach(file => {
        if (fs.existsSync(file)) {
          fs.chmodSync(file, 0o755);
          console.log(`Made ${file} executable`);
        } else {
          console.warn(`Warning: File not found: ${file}`);
          allSuccessful = false;
        }
      });
      return allSuccessful;
    } catch (error) {
      console.error('Warning: Could not set executable permissions:', error.message);
      console.log('You may need to manually make the scripts executable with:');
      console.log('  chmod +x ./dist/index.js ./dist/scripts/setup.js');
      return false;
    }
  },

  /**
   * Ensure the dist/scripts directory exists
   */
  ensureDistScriptsDir: () => {
    const distScriptsDir = path.join(__dirname, '..', 'dist', 'scripts');
    if (!fs.existsSync(distScriptsDir)) {
      try {
        fs.mkdirSync(distScriptsDir, { recursive: true });
        console.log(`Created scripts directory: ${distScriptsDir}`);
        return true;
      } catch (error) {
        console.warn(`Warning: Could not create directory ${distScriptsDir}: ${error.message}`);
        return false;
      }
    }
    return true;
  }
};

module.exports = scriptUtils;
