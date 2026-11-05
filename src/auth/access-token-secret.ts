import { JwtService } from '@nestjs/jwt';

export type AccessKeyring = {
  currentKid: string;
  currentSecret: string;
  previous: Record<string, string>;
};

/**
 * 解析 AUTH_JWT_PREVIOUS_SECRETS。格式是 kid:secret，多项用逗号分隔。
 * @param raw
 */
export function parsePreviousSecrets(raw?: string): Record<string, string> {
  if (!raw) {
    return {};
  }
  const entries = raw
    .split(',')
    .map((part) => {
      const separator = part.indexOf(':');
      if (separator <= 0) {
        return null;
      }
      const kid = part.slice(0, separator).trim();
      const secret = part.slice(separator + 1);
      if (!kid || !secret) {
        return null;
      }
      return [kid, secret] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);
  return Object.fromEntries(entries);
}

/**
 * 按 access token 头里的 kid 选出验签密钥。没有 kid 或密钥不存在时返回空。
 * @param rawToken
 * @param keyring
 * @param jwtService
 */
export function resolveAccessSecret(
  rawToken: string,
  keyring: AccessKeyring,
  jwtService: JwtService,
): string | null {
  const decoded = jwtService.decode(rawToken, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    return null;
  }
  const kid = decoded.header.kid;
  if (!kid) {
    return null;
  }
  if (kid === keyring.currentKid) {
    return keyring.currentSecret;
  }
  return keyring.previous[kid] ?? null;
}
