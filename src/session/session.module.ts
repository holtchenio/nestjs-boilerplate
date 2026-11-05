import {
  // common
  Module,
} from '@nestjs/common';

import { RedisModule } from '../cache/redis.module.js';
import { PrismaSessionPersistenceModule } from './infrastructure/persistence/prisma/prisma-persistence.module.js';
import { SessionRevocationCache } from './session-revocation.cache.js';
import { SessionService } from './session.service.js';

const infrastructurePersistenceModule = PrismaSessionPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, RedisModule],
  providers: [SessionService, SessionRevocationCache],
  exports: [
    SessionService,
    SessionRevocationCache,
    infrastructurePersistenceModule,
  ],
})
export class SessionModule {}
