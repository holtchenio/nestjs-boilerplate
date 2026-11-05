import ms from 'ms';

export type AuthConfig = {
  secret?: string;
  expires?: ms.StringValue;
  refreshSecret?: string;
  refreshExpires?: ms.StringValue;
  forgotSecret?: string;
  forgotExpires?: ms.StringValue;
  confirmEmailSecret?: string;
  confirmEmailExpires?: ms.StringValue;
  uniformErrors: boolean;
  sessionCheck: boolean;
  reuseGraceSeconds: number;
  cookieEnabled: boolean;
  cookieSameSite: 'Lax' | 'Strict' | 'None';
  accessKid: string;
  previousSecrets: Record<string, string>;
  throttleLimit: number;
  loginFailLimit: number;
};
