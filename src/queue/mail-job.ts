export type MailJob =
  | { kind: 'confirm-email'; userId: number; lang: string }
  | { kind: 'forgot-password'; userId: number; lang: string }
  | {
      kind: 'confirm-new-email';
      userId: number;
      lang: string;
      newEmail: string;
    };

export const MAIL_QUEUE = 'mail';

const mailJobBucketMs = 60_000;

/**
 * 同一用户、同一类邮件在 60 秒内共用一个 jobId，避免短时间双击发出第二封。
 * @param job
 * @param now
 */
export function mailJobId(job: MailJob, now = Date.now()): string {
  const bucket = Math.floor(now / mailJobBucketMs);
  return `mail:${job.kind}:${job.userId}:${bucket}`;
}
