import { registerAs } from '@nestjs/config';
import { IsString, Matches } from 'class-validator';
import validateConfig from '../../utils/validate-config.js';
import { RedisConfig } from './redis-config.type.js';

class EnvironmentVariablesValidator {
  @IsString()
  @Matches(/^rediss?:\/\/\S+$/)
  REDIS_URL: string;
}

export default registerAs<RedisConfig>('redis', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    url: process.env.REDIS_URL ?? '',
  };
});
