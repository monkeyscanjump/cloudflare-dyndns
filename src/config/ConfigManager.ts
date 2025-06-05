import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IConfig } from '../types';

/**
 * Manages application configuration from multiple sources
 * Loads from .env files, environment variables and direct configuration
 * with priority handling and OS-specific paths
 */
export class ConfigManager {
  private config: IConfig;

  /**
   * Required configuration parameters for the application to function
   * These must be provided or the validation will fail
   */
  private requiredEnvVars: string[] = [
    'API_TOKEN',
    'DOMAIN',
    'SUBDOMAIN'
  ];

  /**
   * Creates a new configuration manager
   * @param directConfig Optional configuration values to override environment variables
   */
  constructor(directConfig: Partial<IConfig> = {}) {
    this.loadEnvironmentVariables();

    // Initialize configuration with defaults - support both prefixed and non-prefixed env vars
    this.config = {
      API_TOKEN: process.env.API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '',
      ZONE_ID: process.env.ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || '',
      RECORD_ID: process.env.RECORD_ID || process.env.CLOUDFLARE_RECORD_ID || '',
      DOMAIN: process.env.DOMAIN || process.env.CLOUDFLARE_DOMAIN || '',
      SUBDOMAIN: process.env.SUBDOMAIN || process.env.CLOUDFLARE_SUBDOMAIN || '',
      TTL: parseInt(process.env.TTL || process.env.CLOUDFLARE_TTL || '120', 10),
      PROXIED: process.env.PROXIED === 'true' || process.env.CLOUDFLARE_PROXIED === 'true',
      RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS || process.env.CLOUDFLARE_RETRY_ATTEMPTS || '3', 10),
      RETRY_DELAY: parseInt(process.env.RETRY_DELAY || process.env.CLOUDFLARE_RETRY_DELAY || '5000', 10),
      LOG_FILE: process.env.LOG_FILE || process.env.CLOUDFLARE_LOG_FILE || this.getDefaultLogPath(),
      LAST_IP_FILE: process.env.LAST_IP_FILE || process.env.CLOUDFLARE_LAST_IP_FILE || this.getDefaultIpStoragePath(),
      IP_SERVICES: (process.env.IP_SERVICES || process.env.CLOUDFLARE_IP_SERVICES || 'ipify,ifconfig,ipinfo,seeip').split(','),
      FQDN: this.constructFqdn(
        process.env.SUBDOMAIN || process.env.CLOUDFLARE_SUBDOMAIN,
        process.env.DOMAIN || process.env.CLOUDFLARE_DOMAIN
      ),
      API_VERSION: process.env.CLOUDFLARE_API_VERSION || '',
      API_URL: process.env.CLOUDFLARE_API_URL || '',
      AUTO_DETECT_API: process.env.CLOUDFLARE_AUTO_DETECT_API === 'true'
    };

    // Apply direct configuration overrides
    if (directConfig) {
      if (directConfig.API_TOKEN !== undefined) this.config.API_TOKEN = directConfig.API_TOKEN;
      if (directConfig.ZONE_ID !== undefined) this.config.ZONE_ID = directConfig.ZONE_ID;
      if (directConfig.RECORD_ID !== undefined) this.config.RECORD_ID = directConfig.RECORD_ID;
      if (directConfig.DOMAIN !== undefined) this.config.DOMAIN = directConfig.DOMAIN;
      if (directConfig.SUBDOMAIN !== undefined) this.config.SUBDOMAIN = directConfig.SUBDOMAIN;
      if (directConfig.TTL !== undefined) this.config.TTL = directConfig.TTL;
      if (directConfig.PROXIED !== undefined) this.config.PROXIED = directConfig.PROXIED;
      if (directConfig.RETRY_ATTEMPTS !== undefined) this.config.RETRY_ATTEMPTS = directConfig.RETRY_ATTEMPTS;
      if (directConfig.RETRY_DELAY !== undefined) this.config.RETRY_DELAY = directConfig.RETRY_DELAY;
      if (directConfig.LOG_FILE !== undefined) this.config.LOG_FILE = directConfig.LOG_FILE;
      if (directConfig.LAST_IP_FILE !== undefined) this.config.LAST_IP_FILE = directConfig.LAST_IP_FILE;
      if (directConfig.IP_SERVICES !== undefined) this.config.IP_SERVICES = directConfig.IP_SERVICES;
      if (directConfig.FQDN !== undefined) this.config.FQDN = directConfig.FQDN;

      // Recalculate FQDN if domain or subdomain was provided directly
      if (directConfig.DOMAIN !== undefined || directConfig.SUBDOMAIN !== undefined) {
        this.config.FQDN = this.constructFqdn(
          directConfig.SUBDOMAIN || this.config.SUBDOMAIN,
          directConfig.DOMAIN || this.config.DOMAIN
        );
      }
    }

    this.ensureDirectoriesExist();
  }

  /**
   * Sets a configuration value and updates dependent values
   * @param key Configuration key to set
   * @param value New value for the configuration key
   */
  public set<K extends keyof IConfig>(key: K, value: IConfig[K]): void {
    this.config[key] = value;

    // Update FQDN when domain or subdomain changes
    if (key === 'DOMAIN' || key === 'SUBDOMAIN') {
      this.config.FQDN = this.constructFqdn(
        this.config.SUBDOMAIN,
        this.config.DOMAIN
      );
    }
  }

  /**
   * Builds a fully qualified domain name from subdomain and domain parts
   * @param subdomain Subdomain component
   * @param domain Domain component
   * @returns Formatted FQDN or empty string if insufficient parts
   */
  private constructFqdn(subdomain?: string, domain?: string): string {
    if (!subdomain || subdomain.trim() === '') {
      return domain || '';
    }
    return `${subdomain}.${domain || ''}`;
  }

  /**
   * Loads environment variables from multiple locations in priority order
   * Tries several common paths for .env files
   */
  private loadEnvironmentVariables(): void {
    // Possible config locations in order of precedence
    const configLocations = [
      // 1. Local .env file (current directory)
      path.join(process.cwd(), '.env'),

      // 2. User home directory config
      path.join(os.homedir(), '.cloudflare-dyndns', '.env'),

      // 3. System config locations
      ...(process.platform === 'win32'
          ? [path.join(process.env.ProgramData || 'C:\\ProgramData', 'cloudflare-dyndns', '.env')]
          : ['/etc/cloudflare-dyndns/.env']),

      // 4. Package directory
      path.join(__dirname, '..', '..', '.env')
    ];

    // Try loading from each location
    let loaded = false;
    for (const location of configLocations) {
      if (fs.existsSync(location)) {
        dotenv.config({ path: location });
        console.log(`Loaded configuration from ${location}`);
        loaded = true;
        break; // Stop after first found config
      }
    }

    if (!loaded) {
      console.warn('No .env file found. Using environment variables or direct configuration.');
    }
  }

  /**
   * Creates directories needed for logs and IP storage if they don't exist
   */
  private ensureDirectoriesExist(): void {
    const logDir = path.dirname(this.config.LOG_FILE);
    const ipDir = path.dirname(this.config.LAST_IP_FILE);

    [logDir, ipDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`Created directory: ${dir}`);
        } catch (error) {
          console.error(`Error creating directory ${dir}: ${(error as Error).message}`);
        }
      }
    });
  }

  /**
   * Determines the appropriate log file path based on the current OS
   * @returns OS-specific default log path
   */
  private getDefaultLogPath(): string {
    if (process.platform === 'win32') {
      return path.join(
        process.env.PROGRAMDATA || 'C:\\ProgramData',
        'cloudflare-dyndns',
        'logs',
        'cloudflare_dyndns.log'
      );
    } else if (process.platform === 'darwin') {
      return path.join('/Library/Logs', 'cloudflare-dyndns', 'cloudflare_dyndns.log');
    } else {
      // Try to use /var/log but fall back to user directory if permissions don't allow
      try {
        const varLogDir = '/var/log/cloudflare-dyndns';
        if (!fs.existsSync(varLogDir)) {
          fs.mkdirSync(varLogDir, { recursive: true });
        }
        return path.join(varLogDir, 'cloudflare_dyndns.log');
      } catch (error) {
        // Fall back to user's home directory
        return path.join(os.homedir(), '.cloudflare-dyndns', 'logs', 'cloudflare_dyndns.log');
      }
    }
  }

  /**
   * Determines the appropriate IP storage file path based on the current OS
   * @returns OS-specific default path for storing the last known IP
   */
  private getDefaultIpStoragePath(): string {
    if (process.platform === 'win32') {
      return path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        'cloudflare-dyndns',
        'last_ip.txt'
      );
    } else if (process.platform === 'darwin') {
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'cloudflare-dyndns',
        'last_ip.txt'
      );
    } else {
      // Try to use /var/lib but fall back to user directory if permissions don't allow
      try {
        const varLibDir = '/var/lib/cloudflare-dyndns';
        if (!fs.existsSync(varLibDir)) {
          fs.mkdirSync(varLibDir, { recursive: true });
        }
        return path.join(varLibDir, 'last_ip.txt');
      } catch (error) {
        // Fall back to user's home directory
        return path.join(os.homedir(), '.cloudflare-dyndns', 'last_ip.txt');
      }
    }
  }

  /**
   * Validates that all required configuration parameters are present
   * @throws Error if required configuration is missing
   */
  public validate(): void {
    const missing = this.requiredEnvVars.filter(envVar => {
      const value = this.config[envVar as keyof IConfig];
      return !value || (typeof value === 'string' && value.trim() === '');
    });

    if (missing.length > 0) {
      if (process.env.DEVELOPMENT_MODE === 'true') {
        console.error('\n🔧 DEVELOPMENT ERROR: Missing configuration parameters');
        console.error('The following required parameters are missing or empty:');
        missing.forEach(param => {
          console.error(`  - ${param}`);
        });
        console.error('\nTo fix this:');
        console.error('1. Delete your .env file: rm .env');
        console.error('2. Run the setup again: npm run dev:setup');
        console.error('3. Make sure you enter values for ALL required fields\n');
      }

      throw new Error(`Missing or empty required configuration: ${missing.join(', ')}\n\nPlease run 'cloudflare-dyndns-setup' to configure the application or provide the required parameters.`);
    }

    if (this.config.TTL < 60) {
      console.warn('WARNING: TTL less than 60 seconds may cause issues. Recommended minimum is 120 seconds.');
    }
  }

  /**
   * Gets a specific configuration value
   * @param key Configuration key to retrieve
   * @returns Value for the specified configuration key
   */
  public get<K extends keyof IConfig>(key: K): IConfig[K] {
    return this.config[key];
  }

  /**
   * Gets a copy of the entire configuration object
   * @returns Complete configuration object
   */
  public getAll(): IConfig {
    return { ...this.config };
  }

  /**
   * Checks if all required configuration exists
   * @returns True if all required config parameters are present and non-empty
   */
  public configExists(): boolean {
    try {
      return this.requiredEnvVars.every(envVar => {
        const value = this.config[envVar as keyof IConfig];
        return value && (typeof value !== 'string' || value.trim() !== '');
      });
    } catch (error) {
      return false;
    }
  }
}
