---
to: src/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/persistence/prisma/prisma-persistence.module.ts
---
import { Module } from '@nestjs/common';
import { <%= name %>Repository } from '../<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.js';
import { <%= name %>PrismaRepository } from './<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.repository.js';

@Module({
  providers: [
    {
      provide: <%= name %>Repository,
      useClass: <%= name %>PrismaRepository,
    },
  ],
  exports: [<%= name %>Repository],
})
export class Prisma<%= name %>PersistenceModule {}
