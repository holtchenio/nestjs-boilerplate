import { Injectable } from '@nestjs/common';
import { FileType } from '../../files/domain/file.js';
import { FileUrlService } from '../../files/infrastructure/url/file-url.service.js';
import { User } from '../domain/user.js';
import {
  RolePresenter,
  StatusPresenter,
  UserPresenter,
} from './user.presenter.js';

@Injectable()
export class UserPresenterMapper {
  constructor(private readonly fileUrls: FileUrlService) {}

  /**
   * @param user
   */
  async present(user: User | null): Promise<UserPresenter | null> {
    if (!user) {
      return null;
    }
    const presenter = new UserPresenter();
    presenter.id = user.id;
    presenter.email = user.email;
    presenter.password = user.password;
    presenter.provider = user.provider;
    presenter.socialId = user.socialId;
    presenter.firstName = user.firstName;
    presenter.lastName = user.lastName;
    presenter.createdAt = user.createdAt;
    presenter.updatedAt = user.updatedAt;
    presenter.deletedAt = user.deletedAt;
    presenter.role = user.role
      ? Object.assign(new RolePresenter(), {
          id: user.role.id,
          name: user.role.name,
        })
      : user.role;
    presenter.status = user.status
      ? Object.assign(new StatusPresenter(), {
          id: user.status.id,
          name: user.status.name,
        })
      : user.status;
    presenter.photo = user.photo
      ? await this.presentPhoto(user.photo)
      : user.photo;
    return presenter;
  }

  /**
   * @param users
   */
  async presentMany(users: User[]): Promise<UserPresenter[]> {
    const presented = await Promise.all(
      users.map((user) => this.present(user)),
    );
    return presented.filter((user): user is UserPresenter => user !== null);
  }

  /**
   * @param photo
   */
  private async presentPhoto(photo: FileType): Promise<FileType> {
    const presented = new FileType();
    presented.id = photo.id;
    presented.path = await this.fileUrls.toPublicPath(photo.path);
    return presented;
  }
}
