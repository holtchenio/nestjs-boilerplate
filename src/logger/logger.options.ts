import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { Params } from 'nestjs-pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'oldPassword',
  'refreshToken',
  'token',
  'hash',
  '*.password',
  '*.oldPassword',
  '*.refreshToken',
  '*.token',
  '*.hash',
  'req.body.password',
  'req.body.oldPassword',
  'req.body.refreshToken',
  'req.body.token',
  'req.body.hash',
];

/**
 * 使用调用方传入的请求 id；没有时生成一个，并写回响应头。
 * @param req
 * @param res
 */
export function resolveRequestId(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const header = req.headers['x-request-id'];
  const incoming = Array.isArray(header) ? header[0] : header;
  const id = incoming ? incoming : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
}

/**
 * 日志脱敏配置。密码、令牌和认证头不会进入日志。
 */
export function loggerRedact(): { paths: string[]; censor: string } {
  return {
    paths: [...redactPaths],
    censor: '[Redacted]',
  };
}

/**
 * nestjs-pino 的根配置。
 */
export function loggerModuleParams(): Params {
  return {
    pinoHttp: {
      genReqId: resolveRequestId,
      redact: loggerRedact(),
    },
  };
}
