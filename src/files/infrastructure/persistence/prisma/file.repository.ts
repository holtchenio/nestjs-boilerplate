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

  /**
   * 没有 user 引用、且早于给定时间的文件。
   * @param olderThan
   * @param db
   */
  async findOrphanIds(
    olderThan: Date,
    db: DbClient = this.prisma.client,
  ): Promise<string[]> {
    const files = await db.file.findMany({
      where: {
        createdAt: { lt: olderThan },
        users: { none: {} },
      },
      select: { id: true },
    });
    return files.map((file) => file.id);
  }

  /**
   * @param ids
   * @param db
   */
  async deleteByIds(
    ids: string[],
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await db.file.deleteMany({ where: { id: { in: ids } } });
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
