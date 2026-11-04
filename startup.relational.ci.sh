#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh postgres:5432
/opt/wait-for-it.sh redis:6379
pnpm exec prisma migrate deploy
pnpm run seed:run:relational
node dist/worker > /tmp/worker.log 2>&1 &
pnpm run start:prod > prod.log 2>&1 &
/opt/wait-for-it.sh maildev:1080
/opt/wait-for-it.sh localhost:3001
pnpm run lint
pnpm run test:e2e -- --runInBand
