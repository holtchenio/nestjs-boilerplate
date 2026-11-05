# Installation

The API uses PostgreSQL through Prisma, Redis for cache, rate limits, and BullMQ, and Maildev for local mail. There is one package manager: pnpm.

---

## Table of Contents <!-- omit in toc -->

- [Development on the host](#development-on-the-host)
- [Full stack in Docker](#full-stack-in-docker)
- [Links](#links)

---

## Development on the host

1. Clone the repository and enter it.

1. Copy the environment file.

   ```bash
   cp env-example-relational .env
   ```

1. Point the host process at published ports:

   ```bash
   # .env
   DATABASE_HOST=localhost
   MAIL_HOST=localhost
   REDIS_URL=redis://localhost:6379
   ```

   `DATABASE_HOST=postgres` and `MAIL_HOST=maildev` stay correct for containers. Do not point these at a production host.

1. Start PostgreSQL, Redis, and Maildev.

   ```bash
   docker compose up -d postgres redis maildev
   ```

1. Install dependencies from the lockfile.

   ```bash
   pnpm install --frozen-lockfile
   ```

1. Apply migrations, then seed. Seeding is explicit. Starting the API does not seed.

   ```bash
   pnpm exec prisma migrate deploy
   pnpm exec prisma db seed
   ```

1. Start the API and the worker in two terminals.

   ```bash
   pnpm run start:dev
   pnpm run start:worker:dev
   ```

1. Open <http://localhost:3001/docs> and the mail UI at <http://localhost:1080>.

`pnpm run app:config` renames the project the first time you copy this boilerplate. Skip it when contributing to this repository.

## Full stack in Docker

`docker compose up --build` builds three targets from `Dockerfile`:

- `migrator` runs `pnpm exec prisma migrate deploy` once and exits
- `api` runs `node dist/main.js` as user `node`
- `worker` runs `node dist/worker.js` as user `node`

Seed is a separate profile:

```bash
docker compose --profile seed run --rm seed
```

The production image sets `NODE_ENV=production`, so Swagger is not mounted. Use the host dev server when you need `/docs`.

Live and ready:

```bash
curl -sf http://localhost:3001/api/health/live
curl -sf http://localhost:3001/api/health/ready
```

Stop the stack without deleting the database volume:

```bash
docker compose down
```

---

Previous: [Introduction](introduction.md)

Next: [Architecture](architecture.md)
