import redisConfig from './redis.config.js';

describe('redisConfig', () => {
  const previous = process.env.REDIS_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.REDIS_URL;
      return;
    }
    process.env.REDIS_URL = previous;
  });

  it('should reject a missing REDIS_URL', () => {
    delete process.env.REDIS_URL;

    expect(() => redisConfig()).toThrow();
  });

  it('should read a redis URL', () => {
    process.env.REDIS_URL = 'redis://redis:6379';

    expect(redisConfig()).toEqual({ url: 'redis://redis:6379' });
  });
});
