import { MailQueueService } from './mail-queue.service.js';
import { MailJob, mailJobId } from './mail-job.js';
import { Queue } from 'bullmq';

const job: MailJob = {
  kind: 'confirm-email',
  userId: 4,
  lang: 'en',
};

describe('mailJobId', () => {
  it('should keep the same id inside one 60 second bucket', () => {
    const start = 1_700_000_040_000;
    expect(mailJobId(job, start)).toBe(mailJobId(job, start + 59_000));
  });

  it('should change the id after 60 seconds', () => {
    const start = 1_700_000_040_000;
    expect(mailJobId(job, start)).not.toBe(mailJobId(job, start + 60_000));
  });
});

describe('MailQueueService', () => {
  it('should enqueue twice with one job id inside the bucket', async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const service = new MailQueueService({ add } as unknown as Queue);
    const now = 1_700_000_030_000;

    const first = await service.enqueue(job, now);
    const second = await service.enqueue(job, now + 1_000);

    expect(first).toBe(second);
    expect(add).toHaveBeenNthCalledWith(1, job.kind, job, { jobId: first });
    expect(add).toHaveBeenNthCalledWith(2, job.kind, job, { jobId: first });
    expect(JSON.stringify(add.mock.calls)).not.toContain('hash');
  });
});
