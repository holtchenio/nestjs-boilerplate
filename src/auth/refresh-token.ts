import crypto from 'crypto';

/**
 * 生成交给客户端的刷新令牌。明文只出现在响应里，不入库。
 */
export function createRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * 用刷新密钥对令牌做 HMAC-SHA256，得到库里保存的十六进制摘要。
 * @param secret
 * @param token
 */
export function refreshTokenHash(secret: string, token: string): string {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}
