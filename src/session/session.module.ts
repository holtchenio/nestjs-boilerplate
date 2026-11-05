import {
  // common
  Module,
} from '@nestjs/common';

import { RedisModule } from '../cache/redis.module';
import { PrismaSessionPersistenceModule } from './infrastructure/persistence/prisma/prisma-persistence.module';
import { SessionRevocationCache } from './session-revocation.cache';
import { SessionService } from './session.service';

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
