---
to: src/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/persistence/prisma/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.ts
---
import { Injectable } from '@nestjs/common';
import {
  DbClient,
  PrismaService,
} from '../../../../database/prisma.service.js';
import { NullableType } from '../../../../utils/types/nullable.type.js';
import { IPaginationOptions } from '../../../../utils/types/pagination-options.js';
import { DeepPartial } from '../../../../utils/types/deep-partial.type.js';
import { <%= name %> } from '../../../domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.js';
import { <%= name %>Repository } from '../<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.js';

@Injectable()
export class <%= name %>PrismaRepository implements <%= name %>Repository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param data
   * @param db
   */
  async create(
    data: Omit<<%= name %>, 'id' | 'createdAt' | 'updatedAt'>,
    db: DbClient = this.prisma.client,
  ): Promise<<%= name %>> {
    const row = await db.<%= h.inflection.camelize(name, true) %>.create({
      data: {
        // <creating-property-payload />
      },
    });
    void data;
    return toDomain(row);
  }

  /**
   * @param paginationOptions
   * @param db
   */
  async findAllWithPagination(
    {
      paginationOptions,
    }: {
      paginationOptions: IPaginationOptions;
    },
    db: DbClient = this.prisma.client,
  ): Promise<<%= name %>[]> {
    const rows = await db.<%= h.inflection.camelize(name, true) %>.findMany({
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit + 1,
    });
    return rows.map((row) => toDomain(row));
  }

  /**
   * @param id
   * @param db
   */
  async findById(
    id: <%= name %>['id'],
    db: DbClient = this.prisma.client,
  ): Promise<NullableType<<%= name %>>> {
    const row = await db.<%= h.inflection.camelize(name, true) %>.findUnique({
      where: { id },
    });
    return row ? toDomain(row) : null;
  }

  /**
   * @param ids
   * @param db
   */
  async findByIds(
    ids: <%= name %>['id'][],
    db: DbClient = this.prisma.client,
  ): Promise<<%= name %>[]> {
    const rows = await db.<%= h.inflection.camelize(name, true) %>.findMany({
      where: { id: { in: ids } },
    });
    return rows.map((row) => toDomain(row));
  }

  /**
   * @param id
   * @param payload
   * @param db
   */
  async update(
    id: <%= name %>['id'],
    payload: DeepPartial<<%= name %>>,
    db: DbClient = this.prisma.client,
  ): Promise<<%= name %> | null> {
    const row = await db.<%= h.inflection.camelize(name, true) %>.update({
      where: { id },
      data: {
        // <updating-property-payload />
      },
    });
    void payload;
    return toDomain(row);
  }

  /**
   * @param id
   * @param db
   */
  async remove(
    id: <%= name %>['id'],
    db: DbClient = this.prisma.client,
  ): Promise<void> {
    await db.<%= h.inflection.camelize(name, true) %>.delete({ where: { id } });
  }
}

/**
 * @param row
 */
function toDomain(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}): <%= name %> {
  const entity = new <%= name %>();
  entity.id = row.id;
  entity.createdAt = row.createdAt;
  entity.updatedAt = row.updatedAt;
  return entity;
}
