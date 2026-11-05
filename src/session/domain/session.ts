import { User } from '../../users/domain/user.js';

export class Session {
  id: string;
  user: User;
  deviceName: string | null;
  deviceType: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}
