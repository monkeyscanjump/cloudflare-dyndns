import axios, { AxiosRequestConfig } from 'axios';
import { IConfig, CloudflareDnsData, CloudflareApiResponse } from '../types';
import { Logger } from '../utils/Logger';
import { CloudflareApiConfig } from '../config/ApiConfig';
import { IpDetectionService } from './IpDetectionService';

/**
 * Service for interacting with the Cloudflare API
 */
export class CloudflareService {
  private config: IConfig;
  private logger: Logger;
  private axiosConfig: AxiosRequestConfig;
  private apiVersion: string;
  private apiBaseUrl: string;

  constructor(config: IConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;

    // Allow override via environment variables
    this.apiVersion = this.config.API_VERSION || process.env.CLOUDFLARE_API_VERSION || CloudflareApiConfig.version;

    // Use the correct API base URL with "/client"
    this.apiBaseUrl = this.config.API_URL || process.env.CLOUDFLARE_API_URL || CloudflareApiConfig.baseUrl;

    // Store base axios config - headers are handled separately
    this.axiosConfig = {
      timeout: 30000
    };
  }

  /**
   * Get authorization headers for every request
   */
  private getHeaders() {
    // Using API Token authentication (Bearer)
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.API_TOKEN.trim()}`
    };
  }

  /**
   * Build full API URL with version and endpoint
   */
  private getApiUrl(endpoint: string): string {
    return `${this.apiBaseUrl}/${this.apiVersion}${endpoint}`;
  }

  /**
   * Make an API request with fallback for endpoint changes
   */
  private async makeApiRequest<T>(
    endpoint: string,
    method: 'get' | 'post' | 'put' | 'delete' = 'get',
    data?: any
  ): Promise<T> {
    const primaryUrl = this.getApiUrl(endpoint);

    try {
      this.logger.debug(`Making ${method.toUpperCase()} request to: ${primaryUrl}`);

      // FIX: Don't let axiosConfig override the headers
      const response = await axios({
        method,
        url: primaryUrl,
        data,
        timeout: this.axiosConfig.timeout,
        headers: this.getHeaders()
      });

      return response.data;
    } catch (error) {
      this.logger.debug(`API request failed for URL: ${primaryUrl}`);

      if ((error as any).response?.status === 404) {
        this.logger.warn(`Endpoint ${endpoint} returned 404, attempting to detect API changes`);
        return this.handleApiChange(endpoint, method, data, error as Error);
      }

      throw error;
    }
  }

  /**
   * Handle API changes by trying alternative endpoints or versions
   */
  private async handleApiChange<T>(
    endpoint: string,
    method: 'get' | 'post' | 'put' | 'delete',
    data?: any,
    originalError?: Error
  ): Promise<T> {
    // First try alternative versions if this is a version issue
    if (endpoint.includes('/zones') || endpoint.includes('/dns_records')) {
      // Try alternative API versions
      const alternativeVersions = ['v5', 'v4', 'v3'].filter(v => v !== this.apiVersion);

      for (const version of alternativeVersions) {
        try {
          this.logger.debug(`Trying alternative API version: ${version}`);
          const url = `${this.apiBaseUrl}/${version}${endpoint}`;

          // FIX: Don't let axiosConfig override the headers
          const response = await axios({
            method,
            url,
            data,
            timeout: this.axiosConfig.timeout,
            headers: this.getHeaders()
          });

          if (response.status === 200) {
            this.logger.info(`Successfully used API version ${version} - updating configuration`);
            this.apiVersion = version;
            return response.data;
          }
        } catch (versionError) {
          this.logger.debug(`API version ${version} failed: ${(versionError as Error).message}`);
          // Continue to next version
        }
      }
    }

    // If endpoint contains DNS records, try alternative endpoints
    if (endpoint.includes('/dns_records')) {
      const alternativeEndpoints = [
        // v4 alternative formats
        endpoint.replace('/dns_records', '/dns'),
        // v5 potential format
        endpoint.replace('/dns_records', '/dns_records/v2')
      ];

      for (const altEndpoint of alternativeEndpoints) {
        try {
          this.logger.debug(`Trying alternative endpoint: ${altEndpoint}`);
          const url = this.getApiUrl(altEndpoint);

          // FIX: Don't let axiosConfig override the headers
          const response = await axios({
            method,
            url,
            data,
            timeout: this.axiosConfig.timeout,
            headers: this.getHeaders()
          });

          if (response.status === 200) {
            this.logger.info(`Successfully used alternative endpoint: ${altEndpoint}`);
            return response.data;
          }
        } catch (endpointError) {
          this.logger.debug(`Alternative endpoint failed: ${(endpointError as Error).message}`);
          // Continue to next endpoint
        }
      }
    }

    // If all alternatives failed, throw the original error
    throw originalError || new Error(`API request to ${endpoint} failed`);
  }

  /**
   * Initialize the service by looking up missing configuration
   */
  public async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing Cloudflare service and discovering configuration...');

      // Log the API URL being used to help with debugging
      this.logger.debug(`Using Cloudflare API URL: ${this.apiBaseUrl}/${this.apiVersion}`);

      // Check if API version auto-detection is needed
      if (this.config.AUTO_DETECT_API || process.env.CLOUDFLARE_AUTO_DETECT_API === 'true') {
        this.logger.info('Auto-detecting Cloudflare API version...');
        try {
          await this.detectApiVersion();
        } catch (error) {
          this.logger.warn(`API version detection failed: ${(error as Error).message}. Using default version ${this.apiVersion}`);
        }
      }

      // Step 1: If ZONE_ID is missing, fetch available zones
      if (!this.config.ZONE_ID) {
        this.logger.info('No Zone ID provided, attempting to discover zones...');
        const zoneId = await this.lookupZoneId();

        if (zoneId) {
          this.logger.info(`Using Zone ID: ${zoneId}`);
          this.config.ZONE_ID = zoneId;
        } else {
          this.logger.error('Could not automatically determine Zone ID. Please provide ZONE_ID manually.');
          return false;
        }
      }

      // Step 2: Build FQDN if domain and subdomain are provided
      if (this.config.DOMAIN && this.config.SUBDOMAIN && !this.config.FQDN) {
        this.config.FQDN = `${this.config.SUBDOMAIN}.${this.config.DOMAIN}`;
        this.logger.info(`Using FQDN: ${this.config.FQDN}`);
      }

      // Step 3: If we still don't have FQDN but have RECORD_ID, look it up
      if (!this.config.FQDN && this.config.RECORD_ID) {
        this.logger.info('Looking up FQDN from Record ID...');
        const fqdn = await this.lookupFqdnFromRecordId();

        if (fqdn) {
          this.config.FQDN = fqdn;
          this.logger.info(`Using FQDN: ${fqdn}`);

          // Try to extract domain and subdomain from FQDN
          const parts = fqdn.split('.');
          if (parts.length >= 2) {
            this.config.SUBDOMAIN = parts[0];
            this.config.DOMAIN = parts.slice(1).join('.');
            this.logger.debug(`Extracted subdomain: ${this.config.SUBDOMAIN}, domain: ${this.config.DOMAIN}`);
          }
        }
      }

      // Step 4: If RECORD_ID is missing but we have FQDN, look up the record
      if (!this.config.RECORD_ID && this.config.FQDN) {
        this.logger.info(`No Record ID provided, searching for ${this.config.FQDN}...`);
        const recordId = await this.lookupRecordId();

        if (recordId) {
          this.logger.info(`Found Record ID: ${recordId}`);
          this.config.RECORD_ID = recordId;
        } else {
          this.logger.info(`No existing DNS record found for ${this.config.FQDN}. Creating one now...`);
          const newRecordId = await this.createDnsRecord();
          if (newRecordId) {
            this.logger.info(`Created new DNS record with ID: ${newRecordId}`);
            this.config.RECORD_ID = newRecordId;
          } else {
            this.logger.error(`Failed to create DNS record for ${this.config.FQDN}.`);
            return false;
          }
        }
      }

      // Step 5: If we still don't have enough information, try to find a suitable record
      if (!this.config.RECORD_ID) {
        this.logger.info('No record specifics provided, attempting to find a suitable A record...');
        const recordInfo = await this.findSuitableRecord();

        if (recordInfo) {
          this.config.RECORD_ID = recordInfo.id;
          this.config.FQDN = recordInfo.name;

          // Try to extract domain and subdomain
          const parts = recordInfo.name.split('.');
          if (parts.length >= 2) {
            this.config.SUBDOMAIN = parts[0];
            this.config.DOMAIN = parts.slice(1).join('.');
          }

          this.logger.info(`Using A record: ${this.config.FQDN} (ID: ${this.config.RECORD_ID})`);
        } else {
          this.logger.error('Could not find any suitable DNS records. Please create an A record first or provide more specific configuration.');
          return false;
        }
      }

      // Final validation
      if (!this.config.RECORD_ID || !this.config.ZONE_ID) {
        this.logger.error('Could not determine which DNS record to update. Please provide either:');
        this.logger.error('1. API_TOKEN and DOMAIN and SUBDOMAIN values');
        this.logger.error('2. API_TOKEN and FQDN value');
        this.logger.error('3. API_TOKEN and ZONE_ID and RECORD_ID values');
        return false;
      }

      this.logger.info('Configuration successfully initialized');
      this.logger.debug(`Using configuration: Zone ID: ${this.config.ZONE_ID}, Record ID: ${this.config.RECORD_ID}, FQDN: ${this.config.FQDN}`);
      return true;
    } catch (error) {
      this.logger.error(`Error initializing service: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Detect the Cloudflare API version
   */
  private async detectApiVersion(): Promise<string> {
    const versions = ['v4', 'v5', 'v3'];

    for (const version of versions) {
      try {
        // Try a simple endpoint that's likely to exist in all versions
        const testUrl = `${this.apiBaseUrl}/${version}/zones`;

        this.logger.debug(`Testing API version ${version} with URL: ${testUrl}`);

        // FIX: Use only headers and timeout
        const response = await axios.get(testUrl, {
          headers: this.getHeaders(),
          timeout: 5000
        });

        if (response.status === 200 && response.data?.success === true) {
          this.logger.info(`Detected working API version: ${version}`);
          this.apiVersion = version;
          return version;
        }
      } catch (error) {
        // Only log at debug level as this is expected to fail for some versions
        this.logger.debug(`API version ${version} check failed: ${(error as Error).message}`);
      }
    }

    this.logger.warn(`Could not auto-detect API version, using default: ${this.apiVersion}`);
    return this.apiVersion;
  }

  /**
   * Look up the Zone ID for the user's domains
   */
  private async lookupZoneId(): Promise<string | null> {
    try {
      const endpoint = CloudflareApiConfig.endpoints.listZones + '?per_page=50';

      const response = await this.makeApiRequest<CloudflareApiResponse>(endpoint);

      if (response.success && response.result?.length > 0) {
        // If there's only one zone, use it
        if (response.result.length === 1) {
          const zone = response.result[0];
          this.logger.info(`Found single zone: ${zone.name} (${zone.id})`);
          return zone.id;
        }

        // If we have a domain hint, try to find a matching zone
        if (this.config.DOMAIN) {
          const matchingZone = response.result.find((zone: any) =>
            zone.name === this.config.DOMAIN
          );

          if (matchingZone) {
            this.logger.info(`Found matching zone for domain ${this.config.DOMAIN}: ${matchingZone.id}`);
            return matchingZone.id;
          }
        }

        // Otherwise log the available zones for the user
        this.logger.warn('Multiple zones found for this API token. Please specify ZONE_ID in configuration.');
        this.logger.info('Available zones:');
        response.result.forEach((zone: any, index: number) => {
          this.logger.info(`${index + 1}. ${zone.name} (ID: ${zone.id})`);
        });

        // Return the first zone as a fallback if we have to choose something
        this.logger.warn(`Using first zone by default: ${response.result[0].name} (${response.result[0].id})`);
        return response.result[0].id;
      } else {
        this.logger.error('No zones found for this API token. Please verify your token has the correct permissions.');
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to lookup zones: ${(error as Error).message}`);
      if ((error as any).response) {
        this.logger.debug(`API Response Error: ${JSON.stringify((error as any).response.data)}`);
      }
      return null;
    }
  }

  /**
   * Look up the DNS record ID based on FQDN
   */
  public async lookupRecordId(): Promise<string | null> {
    try {
      if (!this.config.ZONE_ID) {
        this.logger.error('Zone ID is required to look up record ID');
        return null;
      }

      if (!this.config.FQDN) {
        this.logger.error('FQDN is required to look up record ID');
        return null;
      }

      const endpoint = CloudflareApiConfig.endpoints.listRecords(this.config.ZONE_ID) + `?type=A&name=${this.config.FQDN}`;

      const response = await this.makeApiRequest<CloudflareApiResponse>(endpoint);

      if (response.success && response.result?.length > 0) {
        return response.result[0].id;
      } else {
        this.logger.warn(`No DNS A records found for ${this.config.FQDN}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to lookup record ID: ${(error as Error).message}`);
      if ((error as any).response) {
        this.logger.debug(`API Response Error: ${JSON.stringify((error as any).response.data)}`);
      }
      return null;
    }
  }

  /**
   * Find a suitable A record to update if specific details aren't provided
   */
  private async findSuitableRecord(): Promise<{ id: string, name: string } | null> {
    try {
      if (!this.config.ZONE_ID) {
        this.logger.error('Zone ID is required to find suitable records');
        return null;
      }

      const endpoint = CloudflareApiConfig.endpoints.listRecords(this.config.ZONE_ID) + '?type=A&per_page=100';

      const response = await this.makeApiRequest<CloudflareApiResponse>(endpoint);

      if (response.success && response.result?.length > 0) {
        // List all available records
        this.logger.info(`Found ${response.result.length} A records:`);
        response.result.forEach((record: any, index: number) => {
          this.logger.info(`${index + 1}. ${record.name} (${record.content})`);
        });

        // Try to find a record that seems like a subdomain (not the root domain)
        // FIXED: Handle case where zone_name might be undefined
        const subdomain = response.result.find((record: any) => {
          const zoneName = record.zone_name || '';
          return record.name !== zoneName && !record.name.includes('*');
        });

        if (subdomain) {
          this.logger.info(`Selected subdomain record: ${subdomain.name}`);
          return { id: subdomain.id, name: subdomain.name };
        }

        // Fallback to the first record
        this.logger.info(`Using first A record: ${response.result[0].name}`);
        return {
          id: response.result[0].id,
          name: response.result[0].name
        };
      } else {
        this.logger.warn('No DNS A records found in this zone');
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to find suitable records: ${(error as Error).message}`);
      if ((error as any).response) {
        this.logger.debug(`API Response Error: ${JSON.stringify((error as any).response.data)}`);
      }
      return null;
    }
  }

  /**
   * Look up the FQDN from a record ID
   */
  private async lookupFqdnFromRecordId(): Promise<string | null> {
    try {
      if (!this.config.ZONE_ID || !this.config.RECORD_ID) {
        return null;
      }

      const endpoint = CloudflareApiConfig.endpoints.getRecord(this.config.ZONE_ID, this.config.RECORD_ID);

      const response = await this.makeApiRequest<CloudflareApiResponse>(endpoint);

      if (response.success && response.result) {
        return response.result.name;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to lookup FQDN from record ID: ${(error as Error).message}`);
      if ((error as any).response) {
        this.logger.debug(`API Response Error: ${JSON.stringify((error as any).response.data)}`);
      }
      return null;
    }
  }

  /**
   * Create a new DNS record
   */
  private async createDnsRecord(): Promise<string | null> {
    try {
      // Get current IP address first
      const ipService = new IpDetectionService(this.logger, this.config.IP_SERVICES);
      const currentIp = await ipService.detectIp();

      if (!currentIp) {
        this.logger.error('Could not detect current IP address to create DNS record');
        return null;
      }

      const data: CloudflareDnsData = {
        type: 'A',
        name: this.config.FQDN,
        content: currentIp,
        ttl: this.config.TTL || 120,
        proxied: this.config.PROXIED || false
      };

      const endpoint = CloudflareApiConfig.endpoints.listRecords(this.config.ZONE_ID);

      const response = await this.makeApiRequest<CloudflareApiResponse>(
        endpoint, 'post', data
      );

      if (response.success && response.result) {
        this.logger.info(`Successfully created DNS record for ${this.config.FQDN} pointing to ${currentIp}`);
        return response.result.id;
      } else {
        const errors = response.errors?.map(e => e.message).join(', ') || 'Unknown error';
        this.logger.error(`Failed to create DNS record: ${errors}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error creating DNS record: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Verify that the API credentials are valid
   */
  public async verifyCredentials(): Promise<boolean> {
    try {
      // First try to verify with token verify endpoint
      try {
        const verifyEndpoint = '/user/tokens/verify';
        const response = await this.makeApiRequest<CloudflareApiResponse>(verifyEndpoint);
        if (response.success) {
          this.logger.info('Successfully verified Cloudflare API credentials using token verify');
          return true;
        }
      } catch (error) {
        this.logger.debug(`Token verify failed: ${(error as Error).message}. Trying fallback verification.`);
      }

      // Fallback to checking zones access
      const endpoint = CloudflareApiConfig.endpoints.listZones + '?per_page=1';
      const response = await this.makeApiRequest<CloudflareApiResponse>(endpoint);

      if (response.success === true) {
        this.logger.info('Successfully verified Cloudflare API credentials using zones endpoint');
        return true;
      } else {
        this.logger.error('API credentials verification failed: API returned unsuccessful response');
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to verify API credentials: ${(error as Error).message}`);
      if ((error as any).response) {
        this.logger.debug(`API Response Error: ${JSON.stringify((error as any).response.data)}`);
      }
      return false;
    }
  }

  /**
   * Update the DNS record with the new IP address
   */
  public async updateDnsRecord(newIp: string): Promise<boolean> {
    const data: CloudflareDnsData = {
      type: 'A',
      name: this.config.FQDN,
      content: newIp,
      ttl: this.config.TTL,
      proxied: this.config.PROXIED
    };

    this.logger.info(`Updating DNS record for ${this.config.FQDN} to ${newIp} (TTL: ${this.config.TTL}, Proxied: ${this.config.PROXIED})`);

    const endpoint = CloudflareApiConfig.endpoints.updateRecord(this.config.ZONE_ID, this.config.RECORD_ID);

    try {
      const response = await this.retryOperation<CloudflareApiResponse>(() =>
        this.makeApiRequest<CloudflareApiResponse>(endpoint, 'put', data)
      );

      if (response.success) {
        this.logger.info(`DNS record for ${this.config.FQDN} successfully updated to ${newIp}`);
        return true;
      } else {
        const errors = response.errors.map(err => err.message).join('; ');
        this.logger.error(`Failed to update DNS record: ${errors}`);
        this.logger.debug(`Cloudflare API response: ${JSON.stringify(response)}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`API error updating DNS record: ${(error as Error).message}`);
      if ((error as any).response) {
        this.logger.debug(`API Response Error: ${JSON.stringify((error as any).response.data)}`);
      }
      return false;
    }
  }

  /**
   * Retry an operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    const maxRetries = this.config.RETRY_ATTEMPTS;
    const retryDelay = this.config.RETRY_DELAY;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if ((error as any).response && (error as any).response.status === 429) {
          // Rate limit encountered - use the retry-after header if available
          const retryAfter = (error as any).response.headers['retry-after']
            ? parseInt((error as any).response.headers['retry-after'], 10) * 1000
            : retryDelay;

          this.logger.warn(`Rate limit hit. Retrying in ${retryAfter/1000} seconds (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
        } else {
          this.logger.warn(`Operation failed. Retrying in ${retryDelay/1000} seconds (Attempt ${attempt}/${maxRetries}): ${(error as Error).message}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }
}
