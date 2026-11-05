import { RedisService } from './redis.service.js';
import Redis from 'ioredis';

describe('RedisService', () => {
  it('should quit the client when the module is destroyed', async () => {
    const quit = vi.fn().mockResolvedValue('OK');
    const service = new RedisService({ quit } as unknown as Redis);

    await service.onModuleDestroy();

    expect(quit).toHaveBeenCalledTimes(1);
  });
});
