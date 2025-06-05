import { ConfigManager } from '../config/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs');
jest.mock('path');
jest.mock('os');

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Mock environment variables
    delete process.env.API_TOKEN;
    delete process.env.DOMAIN;
    delete process.env.SUBDOMAIN;
  });

  test('should load configuration from environment variables', () => {
    process.env.API_TOKEN = 'test-token';
    process.env.DOMAIN = 'example.com';
    process.env.SUBDOMAIN = 'test';

    const configManager = new ConfigManager();

    expect(configManager.get('API_TOKEN')).toBe('test-token');
    expect(configManager.get('DOMAIN')).toBe('example.com');
    expect(configManager.get('SUBDOMAIN')).toBe('test');
  });

  test('should override with direct configuration', () => {
    process.env.API_TOKEN = 'env-token';

    const configManager = new ConfigManager({
      API_TOKEN: 'direct-token',
      DOMAIN: 'direct.example.com'
    });

    expect(configManager.get('API_TOKEN')).toBe('direct-token');
    expect(configManager.get('DOMAIN')).toBe('direct.example.com');
  });

  test('should construct FQDN from domain and subdomain', () => {
    const configManager = new ConfigManager({
      DOMAIN: 'example.com',
      SUBDOMAIN: 'test'
    });

    expect(configManager.get('FQDN')).toBe('test.example.com');
  });

  test('should validate required configuration', () => {
    // Missing required config
    const configManager = new ConfigManager();

    expect(() => configManager.validate()).toThrow();

    // With required config
    const validConfigManager = new ConfigManager({
      API_TOKEN: 'token',
      DOMAIN: 'example.com',
      SUBDOMAIN: 'test'
    });

    expect(() => validConfigManager.validate()).not.toThrow();
  });
});
