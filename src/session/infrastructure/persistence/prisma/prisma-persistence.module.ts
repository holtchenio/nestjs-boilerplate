import { Module } from '@nestjs/common';
import { SessionRepository } from '../session.repository.js';
import { SessionPrismaRepository } from './session.repository.js';

@Module({
  providers: [
    {
      provide: SessionRepository,
      useClass: SessionPrismaRepository,
    },
  ],
  exports: [SessionRepository],
})
export class PrismaSessionPersistenceModule {}
