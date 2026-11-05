import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { FileOrphanCleanup } from '../../files/file-orphan-cleanup.js';
import { FILE_ORPHAN_QUEUE } from '../../queue/file-orphan-job.js';

@Injectable()
export class FileOrphanScheduler implements OnModuleInit {
  constructor(@InjectQueue(FILE_ORPHAN_QUEUE) private readonly queue: Queue) {}

  /**
   * 每小时扫一次。条件是超过 24 小时且没有 user.photoId 引用。
   */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'file-orphans',
      { every: 60 * 60 * 1000 },
      { name: 'cleanup' },
    );
  }
}

@Processor(FILE_ORPHAN_QUEUE)
export class FileOrphanProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLogger,
    private readonly cleanup: FileOrphanCleanup,
  ) {
    super();
    this.logger.setContext(FileOrphanProcessor.name);
  }

  /**
   * @param job
   */
  async process(job: Job): Promise<void> {
    const ids = await this.cleanup.removeUnreferenced();
    this.logger.info({ jobId: job.id, ids }, 'file orphan cleanup finished');
  }
}
