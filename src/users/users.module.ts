import {
  // common
  Module,
  forwardRef,
} from '@nestjs/common';

import { UsersController } from './users.controller.js';

import { UsersService } from './users.service.js';
import { PrismaUserPersistenceModule } from './infrastructure/persistence/prisma/prisma-persistence.module.js';
import { FilesModule } from '../files/files.module.js';
import { SessionModule } from '../session/session.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserPresenterMapper } from './presenters/user-presenter.mapper.js';

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
  providers: [UsersService, UserPresenterMapper],
  exports: [UsersService, UserPresenterMapper, infrastructurePersistenceModule],
})
export class UsersModule {}
