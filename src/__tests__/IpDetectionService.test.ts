import { IpDetectionService } from '../services/IpDetectionService';
import { Logger } from '../utils/Logger';
import axios from 'axios';

// Simple mocks
jest.mock('axios');
jest.mock('../utils/Logger');

describe('IpDetectionService', () => {
  let mockLogger: jest.Mocked<Logger>;
  let ipService: IpDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = new Logger('') as jest.Mocked<Logger>;
    ipService = new IpDetectionService(mockLogger, ['ipify']);
  });

  test('should detect IP from service', async () => {
    // Just one successful response
    (axios.get as jest.Mock).mockResolvedValue({
      data: { ip: '192.168.1.1' }
    });

    const ip = await ipService.detectIp();

    expect(ip).toBe('192.168.1.1');
    expect(axios.get).toHaveBeenCalled();
  });

  test('should throw error when all services fail', async () => {
    // Make axios.get fail
    (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(ipService.detectIp()).rejects.toThrow('Failed to detect public IP');
  });
});
