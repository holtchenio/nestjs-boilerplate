---
to: src/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.module.ts
---
import {
  // do not remove this comment
  Module,
} from '@nestjs/common';
import { <%= h.inflection.transform(name, ['pluralize']) %>Service } from './<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.service.js';
import { <%= h.inflection.transform(name, ['pluralize']) %>Controller } from './<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.controller.js';
import { Prisma<%= name %>PersistenceModule } from './infrastructure/persistence/prisma/prisma-persistence.module.js';

@Module({
  imports: [
    // do not remove this comment
    Prisma<%= name %>PersistenceModule,
  ],
  controllers: [<%= h.inflection.transform(name, ['pluralize']) %>Controller],
  providers: [<%= h.inflection.transform(name, ['pluralize']) %>Service],
  exports: [<%= h.inflection.transform(name, ['pluralize']) %>Service, Prisma<%= name %>PersistenceModule],
})
export class <%= h.inflection.transform(name, ['pluralize']) %>Module {}
