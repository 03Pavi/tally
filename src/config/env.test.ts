import { loadEnv, getEnv, resetEnvCache } from './env.js';

describe('env configuration', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  it('loads valid environment configuration successfully', () => {
    const config = loadEnv({
      TALLY_API_KEY: 'test_key',
      PORT: '4000',
      NODE_ENV: 'test',
    });

    expect(config.TALLY_API_KEY).toBe('test_key');
    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('test');
    expect(config.TALLY_API_BASE_URL).toBe('https://api.tally.so');
    expect(config.TALLY_REQUEST_TIMEOUT_MS).toBe(10000);
    expect(config.TALLY_MAX_RETRIES).toBe(2);
  });

  it('throws an error when TALLY_API_KEY is missing', () => {
    expect(() => loadEnv({ PORT: '3000' })).toThrow('Invalid environment configuration: TALLY_API_KEY');
  });

  it('throws an error when TALLY_API_BASE_URL does not use HTTPS', () => {
    expect(() =>
      loadEnv({
        TALLY_API_KEY: 'test_key',
        TALLY_API_BASE_URL: 'http://api.tally.so',
      })
    ).toThrow('TALLY_API_BASE_URL must use HTTPS protocol');
  });

  it('caches the environment config on getEnv', () => {
    process.env['TALLY_API_KEY'] = 'process_env_key';
    const config1 = getEnv();
    const config2 = getEnv();
    expect(config1).toBe(config2);
  });
});
