# Database

PostgreSQL is the only business database. Prisma is the only ORM. Schema lives in `prisma/schema.prisma`. Migrations live in `prisma/migrations`.

---

## Table of Contents <!-- omit in toc -->

- [Apply migrations](#apply-migrations)
- [Create a migration](#create-a-migration)
- [Seed](#seed)
- [Drift check](#drift-check)

---

## Apply migrations

Against an empty database:

```bash
pnpm exec prisma migrate deploy
```

Do not use `prisma migrate reset` on a database you need to keep.

## Create a migration

Change `prisma/schema.prisma`, then:

```bash
pnpm exec prisma migrate dev --name <change>
```

Commit the generated SQL. `migrate dev` is for local development. Deployed environments use `migrate deploy`.

## Seed

```bash
pnpm exec prisma db seed
```

The seed command is `tsx prisma/seed.ts`. Running it twice does not duplicate the role, status, or admin rows. Docker does not seed on API startup. Use:

```bash
docker compose --profile seed run --rm seed
```

## Drift check

```bash
SHADOW_DATABASE_URL=postgresql://root:secret@localhost:5432/prisma_shadow \
  pnpm exec prisma migrate diff --exit-code \
  --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma
```

`SHADOW_DATABASE_URL` must be a second database, not the application database.

Exit code 0 means the migrations match the schema. Exit code 2 means they differ.

---

Previous: [Command Line Interface](cli.md)

Next: [Auth](auth.md)
