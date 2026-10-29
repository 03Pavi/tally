import { loadEnv, getEnv, resetEnvCache } from './env.js';

describe('env configuration', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  it('loads defaults for the TallyPrime settings', () => {
    const config = loadEnv({ PORT: '4000', NODE_ENV: 'test' });

    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('test');
    expect(config.TALLY_PRIME_URL).toBe('http://localhost:9000');
    expect(config.TALLY_PRIME_TIMEOUT_MS).toBe(15000);
    expect(config.TALLY_PRIME_COMPANY).toBeUndefined();
  });

  it('reads the TallyPrime URL, company and timeout', () => {
    const config = loadEnv({
      TALLY_PRIME_URL: 'http://127.0.0.1:9001',
      TALLY_PRIME_COMPANY: 'Zenmo',
      TALLY_PRIME_TIMEOUT_MS: '5000',
    });

    expect(config.TALLY_PRIME_URL).toBe('http://127.0.0.1:9001');
    expect(config.TALLY_PRIME_COMPANY).toBe('Zenmo');
    expect(config.TALLY_PRIME_TIMEOUT_MS).toBe(5000);
  });

  it('rejects an invalid TallyPrime URL', () => {
    expect(() => loadEnv({ TALLY_PRIME_URL: 'not a url' })).toThrow('TALLY_PRIME_URL');
  });

  it('rejects a non-positive TallyPrime timeout', () => {
    expect(() => loadEnv({ TALLY_PRIME_TIMEOUT_MS: '0' })).toThrow('TALLY_PRIME_TIMEOUT_MS');
  });

  it('does not require any Tally.so setting', () => {
    expect(() => loadEnv({ PORT: '3000' })).not.toThrow();
  });

  it('caches the environment config on getEnv', () => {
    const config1 = getEnv();
    const config2 = getEnv();
    expect(config1).toBe(config2);
  });
});
