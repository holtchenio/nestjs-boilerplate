# Generator checks

Static checks for the Prisma Hygen generators.

```bash
pnpm run test:generators:relational
```

The command needs a clean git worktree. It generates resources, runs lint and build, then restores `src/`.

The old Docker CRUD suite and the document-database suite are gone. They called TypeORM migration scripts and a second database that this repository no longer has. Use `pnpm run test:e2e` for the API.
