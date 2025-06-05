const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Utility functions for install and setup scripts
 * @module scriptUtils
 */
const scriptUtils = {
  /**
   * Determines if the package is being installed globally
   * @returns {boolean} True if this is a global npm installation
   */
  isGlobalInstall: () => {
    return process.env.npm_config_global === 'true';
  },

  /**
   * Gets the path to the global configuration directory
   * @returns {string} Path to the user's global config directory
   */
  getGlobalConfigDir: () => {
    return path.join(os.homedir(), '.cloudflare-dyndns');
  },

  /**
   * Creates the global configuration directory if it doesn't exist
   * @returns {boolean} True if directory exists or was created successfully
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
   * Copies the environment example file to the global configuration directory
   * @returns {boolean} True if the file was copied successfully
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
   * Sets executable permissions on script files for Unix/Linux systems
   * No effect on Windows
   * @returns {boolean} True if all files were made executable or on Windows
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
   * Creates the scripts directory in the dist folder if it doesn't exist
   * @returns {boolean} True if directory exists or was created successfully
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
