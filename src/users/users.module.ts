import {
  // common
  Module,
  forwardRef,
} from '@nestjs/common';

import { UsersController } from './users.controller';

import { UsersService } from './users.service';
import { PrismaUserPersistenceModule } from './infrastructure/persistence/prisma/prisma-persistence.module';
import { FilesModule } from '../files/files.module';
import { SessionModule } from '../session/session.module';
import { AuthModule } from '../auth/auth.module';

const infrastructurePersistenceModule = PrismaUserPersistenceModule;

@Module({
  imports: [
    // import modules, etc.
    infrastructurePersistenceModule,
    FilesModule,
    SessionModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, infrastructurePersistenceModule],
})
export class UsersModule {}
