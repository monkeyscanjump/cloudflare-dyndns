/**
 * Centralized configuration for Cloudflare API
 */
export const CloudflareApiConfig = {
  // FIXED: This should be the exact same URL format that was working before
  baseUrl: 'https://api.cloudflare.com/client',

  // Current API version
  version: 'v4',

  // API endpoints
  endpoints: {
    // Zone endpoints
    listZones: '/zones',

    // DNS record endpoints
    listRecords: (zoneId: string) => `/zones/${zoneId}/dns_records`,
    getRecord: (zoneId: string, recordId: string) => `/zones/${zoneId}/dns_records/${recordId}`,
    updateRecord: (zoneId: string, recordId: string) => `/zones/${zoneId}/dns_records/${recordId}`
  }
};
