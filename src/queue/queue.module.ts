import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AllConfigType } from '../config/config.type.js';
import { MAIL_QUEUE } from './mail-job.js';
import { FILE_ORPHAN_QUEUE } from './file-orphan-job.js';
import { mailDefaultJobOptions } from './mail-job.options.js';
import { MailQueueService } from './mail-queue.service.js';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        connection: {
          url: configService.getOrThrow('redis.url', { infer: true }),
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: MAIL_QUEUE,
      defaultJobOptions: mailDefaultJobOptions,
    }),
    BullModule.registerQueue({
      name: FILE_ORPHAN_QUEUE,
    }),
  ],
  providers: [MailQueueService],
  exports: [BullModule, MailQueueService],
})
export class QueueModule {}
