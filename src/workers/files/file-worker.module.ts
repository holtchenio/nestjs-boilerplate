import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FilesModule } from '../../files/files.module.js';
import { FILE_ORPHAN_QUEUE } from '../../queue/file-orphan-job.js';
import {
  FileOrphanProcessor,
  FileOrphanScheduler,
} from './file-orphan.processor.js';

@Module({
  imports: [FilesModule, BullModule.registerQueue({ name: FILE_ORPHAN_QUEUE })],
  providers: [FileOrphanProcessor, FileOrphanScheduler],
})
export class FileWorkerModule {}
