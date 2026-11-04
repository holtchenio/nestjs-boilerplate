import request from 'supertest';
import { MailMessage } from './types/mail-message.type';

/**
 * 轮询 maildev，直到某封信能抽出 hash。
 * @param mailBaseUrl
 * @param readHash
 * @param timeoutMs
 */
export async function waitForMailHash(
  mailBaseUrl: string,
  readHash: (letter: MailMessage) => string | undefined,
  timeoutMs = 15_000,
): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { body } = await request(mailBaseUrl).get('/email');
    const letters: MailMessage[] = Array.isArray(body) ? body : [];
    for (const letter of letters) {
      const hash = readHash(letter);
      if (hash) {
        return hash;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('timed out waiting for mail');
}
