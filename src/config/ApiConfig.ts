/**
 * Centralized configuration for Cloudflare API endpoints and version information
 * Provides URL builder functions for accessing different Cloudflare resources
 */
export const CloudflareApiConfig = {
  /** Base URL for Cloudflare API including the client path */
  baseUrl: 'https://api.cloudflare.com/client',

  /** Default API version to use */
  version: 'v4',

  /**
   * API endpoint paths and functions
   * Functions construct endpoint paths with required IDs
   */
  endpoints: {
    /** Get all zones (domains) for the authenticated account */
    listZones: '/zones',

    /**
     * Get all DNS records for a specific zone
     * @param zoneId The Cloudflare zone ID
     * @returns Formatted endpoint path
     */
    listRecords: (zoneId: string) => `/zones/${zoneId}/dns_records`,

    /**
     * Get a specific DNS record
     * @param zoneId The Cloudflare zone ID
     * @param recordId The DNS record ID
     * @returns Formatted endpoint path
     */
    getRecord: (zoneId: string, recordId: string) => `/zones/${zoneId}/dns_records/${recordId}`,

    /**
     * Update a specific DNS record
     * @param zoneId The Cloudflare zone ID
     * @param recordId The DNS record ID
     * @returns Formatted endpoint path
     */
    updateRecord: (zoneId: string, recordId: string) => `/zones/${zoneId}/dns_records/${recordId}`
  }
};
