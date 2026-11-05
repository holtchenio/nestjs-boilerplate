import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { HttpErrorFilter } from './http-exception.filter.js';

describe('HttpErrorFilter', () => {
  it('should return a body without a stack for an unknown error', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new HttpErrorFilter().catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0] as { stack?: string };
    expect(body).toEqual({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errors: { server: 'internal' },
    });
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Error: boom');
  });
});
