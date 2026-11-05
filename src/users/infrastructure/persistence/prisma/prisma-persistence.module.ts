import { Module } from '@nestjs/common';
import { UserRepository } from '../user.repository.js';
import { UsersPrismaRepository } from './user.repository.js';

@Module({
  providers: [
    {
      provide: UserRepository,
      useClass: UsersPrismaRepository,
    },
  ],
  exports: [UserRepository],
})
export class PrismaUserPersistenceModule {}
