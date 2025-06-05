import { DynDnsApp } from '../../app/DynDnsApp';
import { CloudflareService } from '../../services/CloudflareService';
import { IpDetectionService } from '../../services/IpDetectionService';
import { IpFileManager } from '../../utils/IpFileManager';
import { Logger } from '../../utils/Logger';

// Simple mocks
jest.mock('../../services/CloudflareService');
jest.mock('../../services/IpDetectionService');
jest.mock('../../utils/IpFileManager');
jest.mock('../../utils/Logger');

describe('DynDnsApp Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Simple mock implementations
    (CloudflareService.prototype.initialize as jest.Mock).mockResolvedValue(true);
    (CloudflareService.prototype.verifyCredentials as jest.Mock).mockResolvedValue(true);
    (CloudflareService.prototype.updateDnsRecord as jest.Mock).mockResolvedValue(true);
    (IpDetectionService.prototype.detectIp as jest.Mock).mockResolvedValue('1.2.3.4');
    (IpFileManager.prototype.getLastIp as jest.Mock).mockReturnValue(null);
    (IpFileManager.prototype.saveIp as jest.Mock).mockReturnValue(true);
  });

  test('should run once successfully when IP has changed', async () => {
    const app = new DynDnsApp({
      API_TOKEN: 'token',
      DOMAIN: 'example.com',
      SUBDOMAIN: 'test',
      LOG_FILE: 'log.txt',
      LAST_IP_FILE: 'ip.txt'
    });

    const result = await app.runOnce();

    expect(result).toBe(true);
    expect(CloudflareService.prototype.updateDnsRecord).toHaveBeenCalledWith('1.2.3.4');
  });
});
