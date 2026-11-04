import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { MAIL_QUEUE, MailJob } from '../../queue/mail-job';

@Processor(MAIL_QUEUE, {
  concurrency: 5,
  lockDuration: 30_000,
})
export class MailProcessor extends WorkerHost {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(MailProcessor.name);
  }

  /**
   * 记录邮件任务。发信在后续任务接入，这里不打印 newEmail。
   * @param job
   */
  async process(job: Job<MailJob>): Promise<void> {
    const fields = {
      jobId: job.id,
      queue: MAIL_QUEUE,
      kind: job.data.kind,
    };
    try {
      this.logger.info(fields, 'mail job received');
      await Promise.resolve();
    } catch (error) {
      this.logger.error({ ...fields, err: error }, 'mail job failed');
      throw error;
    }
  }
}
