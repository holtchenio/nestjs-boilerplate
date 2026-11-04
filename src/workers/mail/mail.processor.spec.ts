import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { MailJob } from '../../queue/mail-job';
import { MailJobHandler } from './mail-job.handler';
import { MailProcessor } from './mail.processor';

describe('MailProcessor', () => {
  it('should log the job id and kind without the new email', async () => {
    const info = jest.fn();
    const handle = jest.fn().mockResolvedValue(undefined);
    const processor = new MailProcessor(
      {
        info,
        error: jest.fn(),
        setContext: jest.fn(),
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
