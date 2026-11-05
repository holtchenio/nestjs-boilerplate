---
name: generate
description: Add entities and properties via this project's Prisma generators (pnpm run generate:resource:relational, pnpm run add:property:to-relational). Use when adding a new entity or a new property to an existing entity in this NestJS boilerplate.
---

# Generate Entities and Properties

持久化只有 Prisma。`package.json` 里保留的命令是 `generate:resource:relational` 和 `add:property:to-relational`。名字里的 relational 只表示 PostgreSQL，生成物不是 TypeORM。

## Add an entity

**Rules:**
- **Never generate `User` or `File` entities** — they already exist. You can reference them in relationships.
- Entity names must be PascalCase and singular (e.g., `Post`, `Category`, `BlogComment`).

**Command:**

```bash
pnpm run generate:resource:relational -- --name {EntityName}
```

Run sequentially, one entity at a time. The generator appends a Prisma model. Run `pnpm exec prisma generate` afterwards. Add a migration when the table should be created.

## Add a property to an entity

**Rules:**
- **Never add `id`, `createdAt`, or `updatedAt`** — these are predefined for all entities.
- Property names must be camelCase (e.g., `firstName`, `isActive`).

**Property kinds:**
- `primitive` — basic types: `string`, `number`, `boolean`, `Date`. Written into `schema.prisma` and the Prisma repository payload.
- `reference` — relationship to another entity. Written into the domain object, DTO, and service. The Prisma relation is not generated.
- `denormalized` — JSON copy stored on the same model.

**Relationship rules:**
- Finish the Prisma relation by hand after the generator updates the domain and DTO.
- For **File** relations, use only `oneToOne` or `manyToOne`.
- `propertyInReference` is only required when `referenceType` is `oneToMany`.
- `--shouldAutoLoad` is ignored. Prisma does not use TypeORM eager loading or Mongoose autopopulate.

**Command:**

```bash
pnpm run add:property:to-relational -- --name {EntityName} --property {propertyName} --kind {kind} --type {type} --referenceType {referenceType} --propertyInReference {propertyInReference} --isAddToDto {isAddToDto} --isOptional {isOptional} --isNullable {isNullable}
```

**Argument rules:**
- `--name` (required): Entity name, PascalCase
- `--property` (required): Property name, camelCase
- `--kind` (required): `primitive` | `reference` | `denormalized`
- `--type` (required): For primitive: `string` | `number` | `boolean` | `Date`. For reference/denormalized: the referenced entity name (e.g., `User`, `File`, `Category`)
- `--referenceType`: Only for reference/denormalized kind. Values: `oneToOne` | `oneToMany` | `manyToOne` | `manyToMany`
- `--propertyInReference`: Only when `referenceType` is `oneToMany`. The property name on the referenced entity.
- `--isAddToDto`: `true` | `false` — whether the property can be set via HTTP request
- `--isOptional`: `true` | `false`
- `--isNullable`: `true` | `false` — only meaningful when `isOptional` is `true`

**Omit arguments that don't apply** (e.g., omit `--referenceType` for primitive properties, omit `--propertyInReference` unless `referenceType` is `oneToMany`).

Run sequentially, one property at a time. Run `pnpm exec prisma generate` after schema changes.
