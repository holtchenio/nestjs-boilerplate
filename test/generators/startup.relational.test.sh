#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh postgres:5432
/opt/wait-for-it.sh maildev:1080
pnpm install --frozen-lockfile
# Apply existing migrations against an empty DB so migration:generate has
# a stable baseline to diff against.
pnpm run migration:run
# Capture the freshly-generated entities (Article, Tag, Comment) as a migration.
pnpm run migration:generate -- src/database/migrations/GeneratorE2E
pnpm run migration:run
pnpm run seed:run:relational
pnpm run start:dev
