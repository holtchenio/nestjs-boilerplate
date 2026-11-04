import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MAIL_QUEUE, MailJob, mailJobId } from './mail-job';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly queue: Queue<MailJob>,
  ) {}

  /**
   * 把一封邮件放进 mail 队列。载荷不含 JWT 和密码。
   * @param job
   * @param now
   */
  async enqueue(job: MailJob, now = Date.now()): Promise<string> {
    const jobId = mailJobId(job, now);
    await this.queue.add(job.kind, job, { jobId });
    return jobId;
  }
}
