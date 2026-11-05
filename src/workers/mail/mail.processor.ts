import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { MAIL_QUEUE, MailJob } from '../../queue/mail-job.js';
import { MailJobHandler } from './mail-job.handler.js';

@Processor(MAIL_QUEUE, {
  concurrency: 5,
  lockDuration: 30_000,
})
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLogger,
    private readonly handler: MailJobHandler,
  ) {
    super();
    this.logger.setContext(MailProcessor.name);
  }

  /**
   * 发送队列中的邮件。失败日志只带 jobId 和 kind。
   * @param job
   */
  async process(job: Job<MailJob>): Promise<void> {
    const fields = {
      jobId: job.id,
      queue: MAIL_QUEUE,
      kind: job.data.kind,
    };
    try {
      await this.handler.handle(job.data);
      this.logger.info(fields, 'mail job completed');
    } catch (error) {
      this.logger.error({ ...fields, err: error }, 'mail job failed');
      throw error;
    }
  }
}
