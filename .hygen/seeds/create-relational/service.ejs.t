---
to: src/database/seeds/relational/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>-seed.service.ts
---
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service.js';

@Injectable()
export class <%= name %>SeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 表为空时插入一行。字段由后续属性生成补上。
   */
  async run() {
    const count = await this.prisma.client.<%= h.inflection.camelize(name, true) %>.count();

    if (count === 0) {
      await this.prisma.client.<%= h.inflection.camelize(name, true) %>.create({
        data: {},
      });
    }
  }
}
