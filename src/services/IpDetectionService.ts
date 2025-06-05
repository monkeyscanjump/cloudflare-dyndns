import axios from 'axios';
import { Logger } from '../utils/Logger';
import { IpServiceEndpoints } from '../types';

/**
 * Service for detecting the current public IP address
 * with multiple fallback services
 */
export class IpDetectionService {
  private logger: Logger;
  private ipServices: string[];
  private ipServiceEndpoints: IpServiceEndpoints;

  constructor(logger: Logger, ipServices: string[] = ['ipify', 'ifconfig', 'ipinfo', 'seeip']) {
    this.logger = logger;

    // Ensure we have a valid list of services
    this.ipServices = ipServices && ipServices.length > 0
      ? ipServices
      : ['ipify', 'ifconfig', 'ipinfo', 'seeip'];

    // Define IP detection services with their parsing logic
    this.ipServiceEndpoints = {
      'ipify': {
        url: 'https://api.ipify.org?format=json',
        parser: (data: any) => data.ip
      },
      'ifconfig': {
        url: 'https://ifconfig.me/ip',
        parser: (data: any) => data.trim()
      },
      'ipinfo': {
        url: 'https://ipinfo.io/json',
        parser: (data: any) => data.ip
      },
      'seeip': {
        url: 'https://api.seeip.org/jsonip',
        parser: (data: any) => data.ip
      },
      // Add additional services as fallbacks
      'ipapi': {
        url: 'https://ipapi.co/json',
        parser: (data: any) => data.ip
      },
      'myip': {
        url: 'https://api.myip.com',
        parser: (data: any) => data.ip
      }
    };
  }

  /**
   * Detect the current public IP address using multiple services
   * with fallback
   */
  public async detectIp(): Promise<string> {
    // Randomize the order of services to distribute load
    const shuffledServices = [...this.ipServices].sort(() => Math.random() - 0.5);
    const errorMessages: string[] = [];

    for (const service of shuffledServices) {
      if (!this.ipServiceEndpoints[service]) {
        this.logger.warn(`Unknown IP detection service: ${service}, skipping`);
        continue;
      }

      try {
        const endpoint = this.ipServiceEndpoints[service];
        this.logger.debug(`Attempting to detect IP using ${service}`);

        const response = await axios.get(endpoint.url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'CloudflareDynDNS/1.0',
            'Accept': 'application/json, text/plain, */*'
          }
        });

        // Ensure we have valid data
        if (!response.data) {
          throw new Error(`Empty response from ${service}`);
        }

        // Parse the IP address
        const ip = endpoint.parser(response.data);

        // Validate IP format
        if (this.isValidIpv4(ip)) {
          this.logger.debug(`Successfully detected IP ${ip} using ${service}`);
          return ip;
        } else {
          const errorMsg = `Invalid IP format received from ${service}: ${ip}`;
          errorMessages.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      } catch (error) {
        const errorMsg = `Failed to detect IP using ${service}: ${(error as Error).message}`;
        errorMessages.push(errorMsg);
        this.logger.warn(errorMsg);
      }
    }

    // If we've reached this point, all services failed
    const errorDetail = errorMessages.length > 0
      ? `\nErrors: ${errorMessages.join('\n')}`
      : '';

    throw new Error(`Failed to detect public IP with all configured services.${errorDetail}`);
  }

  /**
   * Validate IPv4 address format
   */
  private isValidIpv4(ip: string): boolean {
    if (!ip || typeof ip !== 'string') return false;

    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipv4Regex.test(ip)) return false;

    // Validate each octet is between 0-255
    return ip.split('.').map(Number).every(num => num >= 0 && num <= 255);
  }

  /**
   * Attempt to get fallback IP from various sources (for testing/debug only)
   */
  public async getFallbackIp(): Promise<string | null> {
    try {
      // Try one more exotic IP service as a last resort
      const lastResortUrl = 'https://checkip.amazonaws.com/';
      const response = await axios.get(lastResortUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'CloudflareDynDNS/1.0' }
      });

      const ip = response.data.trim();
      if (this.isValidIpv4(ip)) {
        this.logger.debug(`Retrieved fallback IP: ${ip}`);
        return ip;
      }
    } catch (error) {
      this.logger.debug(`Fallback IP detection failed: ${(error as Error).message}`);
    }

    return null;
  }
}
