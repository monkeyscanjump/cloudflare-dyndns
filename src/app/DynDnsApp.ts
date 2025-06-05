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

  constructor(directConfig: Partial<IConfig> = {}, debug: boolean = false) {
    this.debugMode = debug;

    // Initialize components
    this.configManager = new ConfigManager(directConfig);
    this.logger = new Logger(this.configManager.get('LOG_FILE'));

    // Set logger debug mode
    if (this.debugMode) {
      this.logger.setDebugMode(true);
      this.logger.debug('Debug mode enabled');
    }

    // Load custom check interval if provided
    if (process.env.CHECK_INTERVAL) {
      this.checkInterval = parseInt(process.env.CHECK_INTERVAL, 10);
      this.logger.info(`Using custom check interval: ${this.checkInterval}ms`);
    }

    // Load adaptive interval setting
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

    // Setup signal handlers for graceful shutdown
    process.on('SIGINT', this.handleShutdown.bind(this));
    process.on('SIGTERM', this.handleShutdown.bind(this));
  }

  /**
   * Check if setup is needed (configuration missing or incomplete)
   */
  public needsSetup(): boolean {
    return !this.configManager.configExists();
  }

  /**
   * Handle shutdown signals
   */
  private handleShutdown(): void {
    if (this.shutdownRequested) {
      this.logger.warn('Forced shutdown requested. Exiting immediately.');
      process.exit(0);
    }

    this.shutdownRequested = true;
    this.logger.info('Shutdown requested. Waiting for current operation to complete...');

    // If not currently running a check, exit immediately
    if (!this.isRunning) {
      this.logger.info('No operations in progress. Shutting down cleanly.');
      process.exit(0);
    }

    // Otherwise, the current check will finish and then exit
  }

  /**
   * Calculate next check interval using adaptive algorithm
   */
  private calculateNextInterval(ipChanged: boolean): number {
    if (!this.adaptiveInterval) {
      return this.checkInterval;
    }

    if (ipChanged) {
      // IP changed, reset to minimum interval and reset stable counter
      this.consecutiveStableChecks = 0;
      this.logger.debug(`IP changed, resetting interval to minimum: ${this.minInterval}ms`);
      return this.minInterval;
    } else {
      // IP stable, gradually increase interval up to maximum
      this.consecutiveStableChecks++;

      // Exponential backoff: min + (consecutive * consecutive * 5000)
      // This means check intervals will increase: 30s, 35s, 50s, 75s, 110s, etc.
      const backoffFactor = 5000; // 5 seconds
      const consecutiveSquared = this.consecutiveStableChecks * this.consecutiveStableChecks;
      const backoffAmount = Math.min(consecutiveSquared * backoffFactor, this.maxInterval - this.minInterval);
      const calculatedInterval = this.minInterval + backoffAmount;

      const finalInterval = Math.min(calculatedInterval, this.maxInterval);

      this.logger.debug(
        `Adaptive interval calculation: ` +
        `baseMin=${this.minInterval}ms, ` +
        `consecutiveStable=${this.consecutiveStableChecks}, ` +
        `backoff=${backoffAmount}ms, ` +
        `calculated=${calculatedInterval}ms, ` +
        `final=${finalInterval}ms`
      );

      return finalInterval;
    }
  }

  /**
   * Run a single DNS update check
   */
  public async runOnce(): Promise<boolean> {
    this.isRunning = true;

    try {
      // Special handling for development mode
      if (process.env.DEVELOPMENT_MODE === 'true' && this.debugMode) {
        this.logger.debug('Running in development mode - some checks may be skipped');

        // If we're using mock credentials, simulate a successful update
        if (this.configManager.get('API_TOKEN').startsWith('dev_mock_')) {
          this.logger.info('DEV MODE: Using mock credentials - simulating IP detection and update');
          const mockIp = '192.168.1.' + Math.floor(Math.random() * 255);
          this.logger.info(`DEV MODE: Mock public IP: ${mockIp}`);

          // Save the mock IP
          this.ipFileManager.saveIp(mockIp);
          return true;
        }
      }

      // Check if we need setup first
      if (this.needsSetup()) {
        this.logger.error('Configuration is missing or incomplete. Please run cloudflare-dyndns-setup first or provide configuration.');
        return false;
      }

      // 1. Validate configuration
      this.configManager.validate();
      this.logger.info('Starting Cloudflare DynDNS update check');

      // NEW STEP: Initialize CloudflareService to auto-discover missing configuration
      this.logger.info('Initializing service and discovering configuration...');
      const serviceInitialized = await this.cloudflareService.initialize();
      if (!serviceInitialized) {
        this.logger.error('Failed to initialize CloudflareService with the provided configuration.');
        return false;
      }

      // 2. Verify API credentials (optional check, first time only)
      if (!process.env.SKIP_CREDENTIAL_CHECK) {
        const credentialsValid = await this.cloudflareService.verifyCredentials();
        if (!credentialsValid) {
          this.logger.error('Failed to verify Cloudflare API credentials. Please check your API token.');
          return false;
        }
        // Skip future checks in this session
        process.env.SKIP_CREDENTIAL_CHECK = 'true';
      }

      // 3. Get current public IP
      const currentIp = await this.ipDetectionService.detectIp();
      this.logger.info(`Current public IP: ${currentIp}`);

      // 4. Get last known IP
      const lastIp = this.ipFileManager.getLastIp();
      this.logger.debug(`Last known IP: ${lastIp || 'Not found'}`);

      // 5. Compare IPs
      if (currentIp === lastIp) {
        this.logger.info(`IP has not changed (${currentIp}). No update needed.`);
        return true;
      }

      this.logger.info(`IP change detected! Old: ${lastIp || 'Not found'}, New: ${currentIp}`);

      // 6. Update Cloudflare DNS record
      const updateSuccess = await this.cloudflareService.updateDnsRecord(currentIp);

      // 7. If successful, save the new IP
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

      // Check if shutdown was requested during execution
      if (this.shutdownRequested) {
        this.logger.info('Shutdown requested during execution. Exiting cleanly.');
        process.exit(0);
      }
    }
  }

  /**
   * Start continuous monitoring for IP changes
   */
  public async startMonitoring(): Promise<void> {
    this.logger.info('Starting continuous IP monitoring service');

    // Check for configuration before starting monitoring loop
    if (this.needsSetup()) {
      this.logger.error('Configuration is missing or incomplete. Please run cloudflare-dyndns-setup first or provide configuration.');
      process.exit(1);
    }

    let nextInterval = this.checkInterval;
    let ipChanged = false;

    while (true) {
      try {
        // Run the check
        const result = await this.runOnce();
        ipChanged = !result; // If result is false, likely means IP changed but update failed

        // Calculate the next interval based on result
        nextInterval = this.calculateNextInterval(ipChanged);

        this.logger.info(`Next check in ${nextInterval/1000} seconds`);

        // Wait for the next interval
        await new Promise(resolve => setTimeout(resolve, nextInterval));
      } catch (error) {
        this.logger.error(`Error in monitoring loop: ${(error as Error).message}`);
        // Wait a short time before retrying after an error
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }
}
