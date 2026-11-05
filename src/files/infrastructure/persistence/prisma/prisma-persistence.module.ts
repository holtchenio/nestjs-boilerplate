import { Module } from '@nestjs/common';
import { FileRepository } from '../file.repository.js';
import { FilePrismaRepository } from './file.repository.js';

@Module({
  providers: [
    {
      provide: FileRepository,
      useClass: FilePrismaRepository,
    },
  ],
  exports: [FileRepository],
})
export class PrismaFilePersistenceModule {}
