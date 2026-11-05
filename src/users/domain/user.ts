import { FileType } from '../../files/domain/file.js';
import { Role } from '../../roles/domain/role.js';
import { Status } from '../../statuses/domain/status.js';

export class User {
  id: number;

  email: string | null;

  password?: string;

  provider: string;

  socialId?: string | null;

  firstName: string | null;

  lastName: string | null;

  photo?: FileType | null;

  role?: Role | null;

  status?: Status;

  createdAt: Date;

  updatedAt: Date;

  deletedAt: Date;
}
