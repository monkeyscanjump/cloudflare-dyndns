import axios from 'axios';
import { Logger } from '../utils/Logger';
import { IpServiceEndpoints, IpResponseData } from '../types';

/**
 * Service for detecting the current public IP address
 * with multiple fallback services for reliability
 */
export class IpDetectionService {
  private logger: Logger;
  private ipServices: string[];
  private ipServiceEndpoints: IpServiceEndpoints;

  /**
   * Creates a new IP detection service instance
   * @param logger Logger instance for recording detection activity
   * @param ipServices Array of service identifiers to use for IP detection
   */
  constructor(logger: Logger, ipServices: string[] = ['ipify', 'ifconfig', 'ipinfo', 'seeip']) {
    this.logger = logger;
    this.ipServices = ipServices && ipServices.length > 0
      ? ipServices
      : ['ipify', 'ifconfig', 'ipinfo', 'seeip'];

    this.ipServiceEndpoints = {
      'ipify': {
        url: 'https://api.ipify.org?format=json',
        parser: (data: IpResponseData | string) => {
          if (typeof data === 'string') return data.trim();
          return data.ip || '';
        }
      },
      'ifconfig': {
        url: 'https://ifconfig.me/ip',
        parser: (data: IpResponseData | string) => {
          if (typeof data === 'string') return data.trim();
          return data.ip || '';
        }
      },
      'ipinfo': {
        url: 'https://ipinfo.io/json',
        parser: (data: IpResponseData | string) => {
          if (typeof data === 'string') return data.trim();
          return data.ip || '';
        }
      },
      'seeip': {
        url: 'https://api.seeip.org/jsonip',
        parser: (data: IpResponseData | string) => {
          if (typeof data === 'string') return data.trim();
          return data.ip || '';
        }
      },
      'ipapi': {
        url: 'https://ipapi.co/json',
        parser: (data: IpResponseData | string) => {
          if (typeof data === 'string') return data.trim();
          return data.ip || '';
        }
      },
      'myip': {
        url: 'https://api.myip.com',
        parser: (data: IpResponseData | string) => {
          if (typeof data === 'string') return data.trim();
          return data.ip || '';
        }
      }
    };
  }

  /**
   * Detects the current public IP address using multiple services with fallback
   * @returns Promise resolving to the current public IPv4 address
   * @throws Error if all configured IP detection services fail
   */
  public async detectIp(): Promise<string> {
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

        if (!response.data) {
          throw new Error(`Empty response from ${service}`);
        }

        const ip = endpoint.parser(response.data);

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

    const errorDetail = errorMessages.length > 0
      ? `\nErrors: ${errorMessages.join('\n')}`
      : '';

    throw new Error(`Failed to detect public IP with all configured services.${errorDetail}`);
  }

  /**
   * Validates if a string is a properly formatted IPv4 address
   * @param ip String to validate as an IPv4 address
   * @returns True if the string is a valid IPv4 address
   */
  private isValidIpv4(ip: string): boolean {
    if (!ip || typeof ip !== 'string') return false;

    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipv4Regex.test(ip)) return false;

    return ip.split('.').map(Number).every(num => num >= 0 && num <= 255);
  }

  /**
   * Attempts to get a fallback IP from an alternative source
   * Used as a last resort when other methods fail
   * @returns Promise resolving to an IP address or null if unavailable
   */
  public async getFallbackIp(): Promise<string | null> {
    try {
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
