import { CloudflareService } from '../services/CloudflareService';
import { Logger } from '../utils/Logger';
import axios from 'axios';
import { IConfig } from '../types';

jest.mock('axios');
jest.mock('../utils/Logger');

describe('CloudflareService', () => {
  let mockLogger: jest.Mocked<Logger>;
  let config: IConfig;
  let cloudflareService: CloudflareService;

  beforeEach(() => {
    mockLogger = new Logger('test.log') as jest.Mocked<Logger>;
    config = {
      API_TOKEN: 'test-token',
      ZONE_ID: 'zone-id',
      RECORD_ID: 'record-id',
      DOMAIN: 'example.com',
      SUBDOMAIN: 'test',
      FQDN: 'test.example.com',
      TTL: 120,
      PROXIED: false,
      RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 100,
      LOG_FILE: 'test.log',
      LAST_IP_FILE: 'ip.txt',
      IP_SERVICES: ['ipify']
    };

    cloudflareService = new CloudflareService(config, mockLogger);
    jest.resetAllMocks();
  });

  test('should initialize with auto-discovery', async () => {
    // Mock the API responses for auto-discovery
    (axios as any).mockImplementation(() => {
      return Promise.resolve({
        data: {
          success: true,
          result: [{ id: 'discovered-zone-id', name: 'example.com' }]
        }
      });
    });

    // Remove IDs to trigger auto-discovery
    const autoDiscoverConfig = { ...config };
    delete autoDiscoverConfig.ZONE_ID;
    delete autoDiscoverConfig.RECORD_ID;

    const service = new CloudflareService(autoDiscoverConfig, mockLogger);
    const result = await service.initialize();

    expect(result).toBe(true);
    expect(axios).toHaveBeenCalled();
  });

  test('should update DNS record', async () => {
    (axios as any).mockImplementation(() => {
      return Promise.resolve({
        data: {
          success: true,
          result: { id: 'record-id' }
        }
      });
    });

    const result = await cloudflareService.updateDnsRecord('1.2.3.4');

    expect(result).toBe(true);
    expect(axios).toHaveBeenCalledWith(expect.objectContaining({
      method: 'put',
      data: expect.objectContaining({
        content: '1.2.3.4'
      })
    }));
  });

  test('should handle API errors gracefully', async () => {
    (axios as any).mockImplementation(() => {
      return Promise.reject({
        response: {
          status: 403,
          data: {
            success: false,
            errors: [{ message: 'Access denied' }]
          }
        }
      });
    });

    const result = await cloudflareService.updateDnsRecord('1.2.3.4');

    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
