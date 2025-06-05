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
 * Response data structure from IP detection services
 */
export interface IpResponseData {
  ip?: string;
  [key: string]: unknown;
}

/**
 * Service response for IP detection
 */
export interface IpServiceResponse {
  url: string;
  parser: (data: IpResponseData | string) => string;
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
  [key: string]: unknown;
}

/**
 * Cloudflare API request configuration
 */
export interface CloudflareApiRequestConfig {
  method: string;
  url: string;
  data?: Record<string, unknown>;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Cloudflare API response structure
 */
export interface CloudflareApiResponse<T = Record<string, unknown>> {
  success: boolean;
  errors?: CloudflareApiError[];
  result?: T;
  messages?: string[];
}

/**
 * Cloudflare API error response
 */
export interface CloudflareErrorResponse {
  success: boolean;
  errors: CloudflareApiError[];
  messages?: string[];
  result?: null;
}

/**
 * Cloudflare API error structure
 */
export interface CloudflareApiError {
  code: number;
  message: string;
  error_chain?: CloudflareApiError[];
}

/**
 * Cloudflare DNS record
 */
export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  zone_id: string;
  zone_name?: string;
  created_on?: string;
  modified_on?: string;
  locked?: boolean;
}

/**
 * Cloudflare Zone information
 */
export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  development_mode: number;
  name_servers: string[];
}

/**
 * Log levels for the logger
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

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
        [version: string]: ((...args: string[]) => string);
      }
    }
  };
  defaultHeaders: {
    [key: string]: string;
  };
  responseHandlers: {
    [version: string]: {
      isSuccess: (response: CloudflareApiResponse) => boolean;
      extractErrors: (response: CloudflareErrorResponse) => CloudflareApiError[];
      extractResult: <T>(response: CloudflareApiResponse<T>) => T | null;
    }
  };
}

/**
 * Axios related types
 */
export interface AxiosError extends Error {
  response?: {
    status: number;
    data: CloudflareErrorResponse;
    headers?: Record<string, string>;
  };
  message: string;
  isAxiosError?: boolean;
}

/**
 * Type guard for AxiosError
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    Boolean(error.isAxiosError)
  );
}
