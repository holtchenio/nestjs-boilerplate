import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { MailJob } from '../../queue/mail-job.js';
import { MailJobHandler } from './mail-job.handler.js';
import { MailProcessor } from './mail.processor.js';

describe('MailProcessor', () => {
  it('should log the job id and kind without the new email', async () => {
    const info = vi.fn();
    const handle = vi.fn().mockResolvedValue(undefined);
    const processor = new MailProcessor(
      {
        info,
        error: vi.fn(),
        setContext: vi.fn(),
      } as unknown as PinoLogger,
      { handle } as unknown as MailJobHandler,
    );
    const job = {
      id: 'mail:confirm-new-email:9:1',
      data: {
        kind: 'confirm-new-email',
        userId: 9,
        lang: 'en',
        newEmail: 'next@example.com',
      },
    } as Job<MailJob>;

    await processor.process(job);

    expect(handle).toHaveBeenCalledWith(job.data);
    expect(info).toHaveBeenCalledWith(
      {
        jobId: job.id,
        queue: 'mail',
        kind: 'confirm-new-email',
      },
      'mail job completed',
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('next@example.com');
  });
});
