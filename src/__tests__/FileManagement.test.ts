import { IpFileManager } from '../utils/IpFileManager';
import { Logger } from '../utils/Logger';
import * as fs from 'fs';
import * as path from 'path';

// Simple mocks
jest.mock('fs');
jest.mock('path');
jest.mock('../utils/Logger');

describe('IpFileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up path mock
    (path.dirname as jest.Mock).mockReturnValue('test');
  });

  test('should create directory if it does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const mockLogger = new Logger('') as jest.Mocked<Logger>;

    new IpFileManager('test/last_ip.txt', mockLogger);

    expect(fs.mkdirSync).toHaveBeenCalledWith('test', { recursive: true });
  });

  test('should save and retrieve IP', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('1.2.3.4');
    const mockLogger = new Logger('') as jest.Mocked<Logger>;

    const ipFileManager = new IpFileManager('test/last_ip.txt', mockLogger);
    ipFileManager.saveIp('1.2.3.4');
    const ip = ipFileManager.getLastIp();

    expect(ip).toBe('1.2.3.4');
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '1.2.3.4');
  });

  test('should handle file read errors', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Read error');
    });
    const mockLogger = new Logger('') as jest.Mocked<Logger>;

    const ipFileManager = new IpFileManager('test/last_ip.txt', mockLogger);
    const ip = ipFileManager.getLastIp();

    expect(ip).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
