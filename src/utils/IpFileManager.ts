import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

/**
 * Manages the storage and retrieval of the last detected IP address
 * Handles file operations for persisting IP information between runs
 */
export class IpFileManager {
  private ipFilePath: string;
  private logger: Logger;

  /**
   * Creates a new IP file manager
   * @param ipFilePath Path to the file where IP address will be stored
   * @param logger Logger instance for recording file operations
   */
  constructor(ipFilePath: string, logger: Logger) {
    this.ipFilePath = ipFilePath;
    this.logger = logger;
    this.ensureIpFileDirectoryExists();
  }

  /**
   * Ensures the directory for the IP file exists, creating it if necessary
   * @throws Error if the directory cannot be created
   */
  private ensureIpFileDirectoryExists(): void {
    const ipDir = path.dirname(this.ipFilePath);
    if (!fs.existsSync(ipDir)) {
      try {
        fs.mkdirSync(ipDir, { recursive: true });
        this.logger.debug(`Created IP storage directory: ${ipDir}`);
      } catch (err) {
        this.logger.error(`Could not create IP storage directory ${ipDir}: ${(err as Error).message}`);
        throw err;
      }
    }
  }

  /**
   * Retrieves the last saved IP address from storage
   * @returns The last saved IP address or null if none exists
   */
  public getLastIp(): string | null {
    try {
      if (fs.existsSync(this.ipFilePath)) {
        return fs.readFileSync(this.ipFilePath, 'utf8').trim();
      }
    } catch (error) {
      this.logger.warn(`Could not read last IP file: ${(error as Error).message}`);
    }
    return null;
  }

  /**
   * Saves the current IP address to storage
   * @param ip Current IP address to save
   * @returns True if the save operation was successful
   */
  public saveIp(ip: string): boolean {
    try {
      fs.writeFileSync(this.ipFilePath, ip);
      this.logger.debug(`Saved IP ${ip} to ${this.ipFilePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to save IP to file: ${(error as Error).message}`);
      return false;
    }
  }
}
