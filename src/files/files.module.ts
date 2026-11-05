import {
  // common
  Module,
} from '@nestjs/common';

import { PrismaFilePersistenceModule } from './infrastructure/persistence/prisma/prisma-persistence.module.js';
import { FilesService } from './files.service.js';
import fileConfig from './config/file.config.js';
import { FileConfig, FileDriver } from './config/file-config.type.js';
import { FilesLocalModule } from './infrastructure/uploader/local/files.module.js';
import { FilesS3Module } from './infrastructure/uploader/s3/files.module.js';
import { FilesS3PresignedModule } from './infrastructure/uploader/s3-presigned/files.module.js';
const infrastructurePersistenceModule = PrismaFilePersistenceModule;

const infrastructureUploaderModule =
  (fileConfig() as FileConfig).driver === FileDriver.LOCAL
    ? FilesLocalModule
    : (fileConfig() as FileConfig).driver === FileDriver.S3
      ? FilesS3Module
      : FilesS3PresignedModule;

@Module({
  imports: [
    // import modules, etc.
    infrastructurePersistenceModule,
    infrastructureUploaderModule,
  ],
  providers: [FilesService],
  exports: [FilesService, infrastructurePersistenceModule],
})
export class FilesModule {}
