import { Writable } from 'stream';
import pino from 'pino';
import { loggerRedact, resolveRequestId } from './logger.options.js';
import { IncomingMessage, ServerResponse } from 'http';

describe('logger redaction', () => {
  it('should omit passwords and authorization headers', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const logger = pino({ redact: loggerRedact() }, stream);
    const secret = 'super-secret-value';

    logger.info(
      {
        req: {
          headers: {
            authorization: `Bearer ${secret}`,
            cookie: `session=${secret}`,
          },
          body: {
            password: secret,
            oldPassword: secret,
            refreshToken: secret,
            token: secret,
            hash: secret,
          },
        },
        res: {
          headers: {
            'set-cookie': [`refresh_token=${secret}`],
          },
        },
        password: secret,
      },
      'login',
    );

    const output = lines.join('');
    expect(output).not.toContain(secret);
    expect(output).toContain('[Redacted]');
  });

  it('should keep a caller supplied request id', () => {
    const headers: Record<string, string | string[]> = {
      'x-request-id': 'req-123',
    };
    const setHeader = vi.fn();
    const id = resolveRequestId(
      { headers } as IncomingMessage,
      { setHeader } as unknown as ServerResponse,
    );

    expect(id).toBe('req-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
  });
});
