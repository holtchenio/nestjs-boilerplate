import { AppConfig } from './app-config.type.js';
import { AppleConfig } from '../auth-apple/config/apple-config.type.js';
import { AuthConfig } from '../auth/config/auth-config.type.js';
import { DatabaseConfig } from '../database/config/database-config.type.js';
import { FacebookConfig } from '../auth-facebook/config/facebook-config.type.js';
import { FileConfig } from '../files/config/file-config.type.js';
import { GoogleConfig } from '../auth-google/config/google-config.type.js';
import { MailConfig } from '../mail/config/mail-config.type.js';
import { RedisConfig } from '../cache/config/redis-config.type.js';

export type AllConfigType = {
  app: AppConfig;
  apple: AppleConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  facebook: FacebookConfig;
  file: FileConfig;
  google: GoogleConfig;
  mail: MailConfig;
  redis: RedisConfig;
};
