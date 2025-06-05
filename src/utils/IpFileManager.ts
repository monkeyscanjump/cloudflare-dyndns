import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

/**
 * Manages the storage and retrieval of the last detected IP address
 */
export class IpFileManager {
  private ipFilePath: string;
  private logger: Logger;

  constructor(ipFilePath: string, logger: Logger) {
    this.ipFilePath = ipFilePath;
    this.logger = logger;
    this.ensureIpFileDirectoryExists();
  }

  /**
   * Ensure the directory for the IP file exists
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
   * Get the last saved IP address
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
   * Save the current IP address
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
