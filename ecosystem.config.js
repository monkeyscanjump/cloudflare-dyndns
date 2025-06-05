const os = require('os');
const path = require('path');
const fs = require('fs');

// Helper to determine appropriate paths based on platform
function getPlatformPaths() {
  if (process.platform === 'win32') {
    return {
      log_file: path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'cloudflare-dyndns', 'logs', 'pm2.log'),
      error_file: path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'cloudflare-dyndns', 'logs', 'pm2-error.log')
    };
  } else if (process.platform === 'darwin') {
    return {
      log_file: path.join('/Library/Logs', 'cloudflare-dyndns', 'pm2.log'),
      error_file: path.join('/Library/Logs', 'cloudflare-dyndns', 'pm2-error.log')
    };
  } else {
    // For Linux, simply return the standard paths
    // PM2 will create the directories if they don't exist
    const varLogExists = fs.existsSync('/var/log');
    if (varLogExists && fs.accessSync('/var/log', fs.constants.W_OK)) {
      return {
        log_file: '/var/log/cloudflare-dyndns/pm2.log',
        error_file: '/var/log/cloudflare-dyndns/pm2-error.log'
      };
    } else {
      // Fall back to user's home directory if /var/log isn't writable
      return {
        log_file: path.join(os.homedir(), '.cloudflare-dyndns', 'logs', 'pm2.log'),
        error_file: path.join(os.homedir(), '.cloudflare-dyndns', 'logs', 'pm2-error.log')
      };
    }
  }
}

const paths = getPlatformPaths();

module.exports = {
  apps : [{
    name: 'cloudflare-dyndns',
    script: './dist/index.js',
    args: '--continuous',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    time: true,
    // Try to find .env in standard locations
    env: {
      NODE_ENV: 'production'
    },
    log_file: paths.log_file,
    error_file: paths.error_file,
    merge_logs: true,
    max_memory_restart: '100M'
  }]
};
