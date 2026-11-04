#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh postgres:5432
/opt/wait-for-it.sh redis:6379
/opt/wait-for-it.sh maildev:1080
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm run seed:run:relational
pnpm run start:worker:dev > /tmp/worker.log 2>&1 &
pnpm run start:dev
