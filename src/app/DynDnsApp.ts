import { ConfigManager } from '../config/ConfigManager';
import { Logger } from '../utils/Logger';
import { IpDetectionService } from '../services/IpDetectionService';
import { CloudflareService } from '../services/CloudflareService';
import { IpFileManager } from '../utils/IpFileManager';
import { IConfig } from '../types';

/**
 * Main application class that orchestrates the DNS update process
 * with continuous monitoring capability
 */
export class DynDnsApp {
  private configManager: ConfigManager;
  private logger: Logger;
  private ipDetectionService: IpDetectionService;
  private cloudflareService: CloudflareService;
  private ipFileManager: IpFileManager;
  private isRunning: boolean = false;
  private checkInterval: number = 60000; // Default: 1 minute
  private adaptiveInterval: boolean = true;
  private maxInterval: number = 300000; // Max 5 minutes between checks
  private minInterval: number = 30000;  // Min 30 seconds between checks
  private consecutiveStableChecks: number = 0;
  private shutdownRequested: boolean = false;
  private debugMode: boolean = false;

  /**
   * Creates a new DynDns application instance
   * @param directConfig Optional configuration overrides
   * @param debug Enable debug logging
   */
  constructor(directConfig: Partial<IConfig> = {}, debug: boolean = false) {
    this.debugMode = debug;
    this.configManager = new ConfigManager(directConfig);
    this.logger = new Logger(this.configManager.get('LOG_FILE'));

    if (this.debugMode) {
      this.logger.setDebugMode(true);
      this.logger.debug('Debug mode enabled');
    }

    // Apply environment variable overrides
    if (process.env.CHECK_INTERVAL) {
      this.checkInterval = parseInt(process.env.CHECK_INTERVAL, 10);
      this.logger.info(`Using custom check interval: ${this.checkInterval}ms`);
    }

    if (process.env.ADAPTIVE_INTERVAL) {
      this.adaptiveInterval = process.env.ADAPTIVE_INTERVAL === 'true';
      this.logger.info(`Adaptive interval: ${this.adaptiveInterval}`);
    }

    // Initialize services
    this.ipDetectionService = new IpDetectionService(
      this.logger,
      this.configManager.get('IP_SERVICES')
    );

    this.cloudflareService = new CloudflareService(
      this.configManager.getAll(),
      this.logger
    );

    this.ipFileManager = new IpFileManager(
      this.configManager.get('LAST_IP_FILE'),
      this.logger
    );

    // Register shutdown handlers
    process.on('SIGINT', this.handleShutdown.bind(this));
    process.on('SIGTERM', this.handleShutdown.bind(this));
  }

  /**
   * Checks if configuration setup is needed
   * @returns True if configuration is missing or incomplete
   */
  public needsSetup(): boolean {
    return !this.configManager.configExists();
  }

  /**
   * Handles graceful shutdown on SIGINT/SIGTERM
   */
  private handleShutdown(): void {
    if (this.shutdownRequested) {
      this.logger.warn('Forced shutdown requested. Exiting immediately.');
      process.exit(0);
    }

    this.shutdownRequested = true;
    this.logger.info('Shutdown requested. Waiting for current operation to complete...');

    if (!this.isRunning) {
      this.logger.info('No operations in progress. Shutting down cleanly.');
      process.exit(0);
    }
  }

  /**
   * Calculates the next check interval using adaptive algorithm
   * @param ipChanged Whether the IP changed in the last check
   * @returns Time in milliseconds to wait before next check
   */
  private calculateNextInterval(ipChanged: boolean): number {
    if (!this.adaptiveInterval) {
      return this.checkInterval;
    }

    if (ipChanged) {
      this.consecutiveStableChecks = 0;
      this.logger.debug(`IP changed, resetting interval to minimum: ${this.minInterval}ms`);
      return this.minInterval;
    }

    // IP stable, gradually increase interval up to maximum
    this.consecutiveStableChecks++;

    // Quadratic backoff formula: min + (consecutive² * factor)
    const backoffFactor = 5000; // 5 seconds
    const consecutiveSquared = this.consecutiveStableChecks * this.consecutiveStableChecks;
    const backoffAmount = Math.min(consecutiveSquared * backoffFactor, this.maxInterval - this.minInterval);
    const calculatedInterval = this.minInterval + backoffAmount;
    const finalInterval = Math.min(calculatedInterval, this.maxInterval);

    this.logger.debug(
      `Adaptive interval: stable=${this.consecutiveStableChecks}, ` +
      `backoff=${backoffAmount}ms, final=${finalInterval}ms`
    );

    return finalInterval;
  }

  /**
   * Runs a single DNS update check
   * @returns True if check completed successfully (even if no update needed)
   */
  public async runOnce(): Promise<boolean> {
    this.isRunning = true;

    try {
      // Handle development mode
      if (process.env.DEVELOPMENT_MODE === 'true' && this.debugMode) {
        this.logger.debug('Running in development mode - some checks may be skipped');

        if (this.configManager.get('API_TOKEN').startsWith('dev_mock_')) {
          this.logger.info('DEV MODE: Using mock credentials - simulating IP detection and update');
          const mockIp = '192.168.1.' + Math.floor(Math.random() * 255);
          this.logger.info(`DEV MODE: Mock public IP: ${mockIp}`);
          this.ipFileManager.saveIp(mockIp);
          return true;
        }
      }

      if (this.needsSetup()) {
        this.logger.error('Configuration is missing or incomplete. Please run cloudflare-dyndns-setup first.');
        return false;
      }

      this.configManager.validate();
      this.logger.info('Starting Cloudflare DynDNS update check');

      // Initialize CloudflareService to auto-discover missing configuration
      this.logger.info('Initializing service and discovering configuration...');
      const serviceInitialized = await this.cloudflareService.initialize();
      if (!serviceInitialized) {
        this.logger.error('Failed to initialize CloudflareService with the provided configuration.');
        return false;
      }

      // Verify API credentials (first time only)
      if (!process.env.SKIP_CREDENTIAL_CHECK) {
        const credentialsValid = await this.cloudflareService.verifyCredentials();
        if (!credentialsValid) {
          this.logger.error('Failed to verify Cloudflare API credentials. Please check your API token.');
          return false;
        }
        process.env.SKIP_CREDENTIAL_CHECK = 'true';
      }

      // Get current public IP
      const currentIp = await this.ipDetectionService.detectIp();
      this.logger.info(`Current public IP: ${currentIp}`);

      // Compare with last known IP
      const lastIp = this.ipFileManager.getLastIp();
      this.logger.debug(`Last known IP: ${lastIp || 'Not found'}`);

      if (currentIp === lastIp) {
        this.logger.info(`IP has not changed (${currentIp}). No update needed.`);
        return true;
      }

      this.logger.info(`IP change detected! Old: ${lastIp || 'Not found'}, New: ${currentIp}`);

      // Update Cloudflare DNS record
      const updateSuccess = await this.cloudflareService.updateDnsRecord(currentIp);

      // Save the new IP if update was successful
      if (updateSuccess) {
        this.ipFileManager.saveIp(currentIp);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Application error: ${(error as Error).message}`);
      return false;
    } finally {
      this.isRunning = false;

      if (this.shutdownRequested) {
        this.logger.info('Shutdown requested during execution. Exiting cleanly.');
        process.exit(0);
      }
    }
  }

  /**
   * Starts continuous monitoring for IP changes
   * Uses adaptive intervals to check more frequently when IP is changing
   */
  public async startMonitoring(): Promise<void> {
    this.logger.info('Starting continuous IP monitoring service');

    if (this.needsSetup()) {
      this.logger.error('Configuration is missing or incomplete. Please run cloudflare-dyndns-setup first.');
      process.exit(1);
    }

    let nextInterval = this.checkInterval;
    let ipChanged = false;

    this.isRunning = true;
    while (this.isRunning) {
      try {
        const result = await this.runOnce();
        ipChanged = !result; // If result is false, likely means IP changed but update failed
        nextInterval = this.calculateNextInterval(ipChanged);

        this.logger.info(`Next check in ${nextInterval/1000} seconds`);
        await new Promise(resolve => setTimeout(resolve, nextInterval));
      } catch (error) {
        this.logger.error(`Error in monitoring loop: ${(error as Error).message}`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }
}
