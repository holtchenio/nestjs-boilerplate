import { NullableType } from '../../../utils/types/nullable.type.js';
import { FileType } from '../../domain/file.js';

export abstract class FileRepository {
  abstract create(data: Omit<FileType, 'id'>): Promise<FileType>;

  abstract findById(id: FileType['id']): Promise<NullableType<FileType>>;

  abstract findByIds(ids: FileType['id'][]): Promise<FileType[]>;

  /**
   * @param olderThan
   */
  abstract findOrphanIds(olderThan: Date): Promise<string[]>;

  /**
   * @param ids
   */
  abstract deleteByIds(ids: string[]): Promise<void>;
}
