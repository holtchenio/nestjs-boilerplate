import { DbClient } from '../../../database/prisma.service';
import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../utils/types/pagination-options';
import { User } from '../../domain/user';

import { FilterUserDto, SortUserDto } from '../../dto/query-user.dto';

export abstract class UserRepository {
  abstract create(
    data: Omit<User, 'id' | 'createdAt' | 'deletedAt' | 'updatedAt'>,
  ): Promise<User>;

  abstract findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]>;

  /**
   * @param id
   * @param db
   */
  abstract findById(id: User['id'], db?: DbClient): Promise<NullableType<User>>;

  abstract findByIds(ids: User['id'][]): Promise<User[]>;

  /**
   * @param email
   * @param db
   */
  abstract findByEmail(
    email: User['email'],
    db?: DbClient,
  ): Promise<NullableType<User>>;
  abstract findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>>;

  /**
   * @param id
   * @param payload
   * @param db
   */
  abstract update(
    id: User['id'],
    payload: DeepPartial<User>,
    db?: DbClient,
  ): Promise<User | null>;

  abstract remove(id: User['id']): Promise<void>;
}
