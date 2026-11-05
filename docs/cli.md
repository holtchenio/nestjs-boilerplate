# Command Line Interface (CLI)

---

## Table of Contents <!-- omit in toc -->

- [Generate resource](#generate-resource)
- [Add property to resource](#add-property-to-resource)

---

## Generate resource

生成的模块使用 Prisma。命令名仍是 `relational`。

```bash
pnpm run generate:resource:relational -- --name ResourceName
```

Example:

```bash
pnpm run generate:resource:relational -- --name Category
```

生成结果会写入 `prisma/schema.prisma`。之后执行 `pnpm exec prisma generate`，需要落库时再写迁移。

## Add property to resource

```bash
pnpm run add:property:to-relational
```

标量字段会写进对应的 Prisma model。关系字段只进入领域对象和 DTO，Prisma 关系需要手写。

---

Previous: [Architecture](architecture.md)

Next: [Database](database.md)
