/**
 * 重置链接的密钥带上当前密码哈希，密码一变，旧链接就失效。
 * @param secret
 * @param passwordHash
 */
export function forgotPasswordSecret(
  secret: string,
  passwordHash?: string | null,
): string {
  return `${secret}${passwordHash ?? ''}`;
}
