import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { MailJob } from '../../queue/mail-job';
import { MailProcessor } from './mail.processor';

describe('MailProcessor', () => {
  it('should log the job id and kind without the new email', async () => {
    const info = jest.fn();
    const processor = new MailProcessor({
      info,
      setContext: jest.fn(),
    } as unknown as PinoLogger);
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

    expect(info).toHaveBeenCalledWith(
      {
        jobId: job.id,
        queue: 'mail',
        kind: 'confirm-new-email',
      },
      'mail job received',
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('next@example.com');
  });
});
