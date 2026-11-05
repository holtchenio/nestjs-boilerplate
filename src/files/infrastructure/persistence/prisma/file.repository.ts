import { Injectable } from '@nestjs/common';
import {
  DbClient,
  PrismaService,
} from '../../../../database/prisma.service.js';
import { NullableType } from '../../../../utils/types/nullable.type.js';
import { FileType } from '../../../domain/file.js';
import { FileRepository } from '../file.repository.js';

@Injectable()
export class FilePrismaRepository implements FileRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param data
   * @param db
   */
  async create(
    data: Omit<FileType, 'id'>,
    db: DbClient = this.prisma.client,
  ): Promise<FileType> {
    const file = await db.file.create({
      data: { path: data.path },
    });
    return toDomain(file);
  }

  /**
   * @param id
   * @param db
   */
  async findById(
    id: FileType['id'],
    db: DbClient = this.prisma.client,
  ): Promise<NullableType<FileType>> {
    const file = await db.file.findUnique({ where: { id } });
    return file ? toDomain(file) : null;
  }

  /**
   * @param ids
   * @param db
   */
  async findByIds(
    ids: FileType['id'][],
    db: DbClient = this.prisma.client,
  ): Promise<FileType[]> {
    const files = await db.file.findMany({ where: { id: { in: ids } } });
    return files.map((file) => toDomain(file));
  }
}

/**
 * @param raw
 */
function toDomain(raw: { id: string; path: string }): FileType {
  const file = new FileType();
  file.id = raw.id;
  file.path = raw.path;
  return file;
}
