/**
 * Core configuration options for the application
 */
export interface IConfig {
  API_TOKEN: string;
  ZONE_ID?: string;
  RECORD_ID?: string;
  DOMAIN: string;
  SUBDOMAIN: string;
  FQDN: string;
  TTL: number;
  PROXIED: boolean;
  RETRY_ATTEMPTS: number;
  RETRY_DELAY: number;
  LOG_FILE: string;
  LAST_IP_FILE: string;
  IP_SERVICES: string[];
  API_VERSION?: string;
  API_URL?: string;
  AUTO_DETECT_API?: boolean;
}

/**
 * Service response for IP detection
 */
export interface IpServiceResponse {
  url: string;
  parser: (data: any) => string;
}

/**
 * Interface for IP detection services
 */
export interface IpServiceEndpoints {
  [key: string]: IpServiceResponse;
}

/**
 * Cloudflare DNS update data
 */
export interface CloudflareDnsData {
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

/**
 * Cloudflare API response structure
 */
export interface CloudflareApiResponse {
  success: boolean;
  errors: CloudflareApiError[];
  result?: any;
}

/**
 * Cloudflare API error structure
 */
export interface CloudflareApiError {
  code: number;
  message: string;
}

/**
 * Log levels for the logger
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * IP service configuration
 */
export interface IpServiceConfig {
  name: string;
  url: string;
  parser: (data: any) => string;
}

/**
 * Command line arguments interface
 */
export interface CommandLineArgs {
  help: boolean;
  version: boolean;
  continuous: boolean;
  setup: boolean;
  debug?: boolean;
}

/**
 * Cloudflare API configuration
 */
export interface CloudflareApiConfigType {
  baseUrl: string;
  version: string;
  supportedVersions: string[];
  endpoints: {
    verifyToken: string;
    listZones: string;
    listRecords: (zoneId: string) => string;
    getRecord: (zoneId: string, recordId: string) => string;
    updateRecord: (zoneId: string, recordId: string) => string;
    alternativeEndpoints: {
      [key: string]: {
        [version: string]: ((...args: any[]) => string);
      }
    }
  };
  defaultHeaders: {
    [key: string]: string;
  };
  responseHandlers: {
    [version: string]: {
      isSuccess: (response: any) => boolean;
      extractErrors: (response: any) => any[];
      extractResult: (response: any) => any;
    }
  };
}
