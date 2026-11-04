import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AllConfigType } from '../config/config.type';
import { MAIL_QUEUE } from './mail-job';
import { mailDefaultJobOptions } from './mail-job.options';
import { MailQueueService } from './mail-queue.service';

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
  ],
  providers: [MailQueueService],
  exports: [BullModule, MailQueueService],
})
export class QueueModule {}
