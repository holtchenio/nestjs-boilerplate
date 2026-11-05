# Tests

## Table of Contents <!-- omit in toc -->

- [Unit tests](#unit-tests)
- [E2E tests](#e2e-tests)
- [Docker](#docker)

## Unit tests

```bash
pnpm test
```

## E2E tests

PostgreSQL, Redis, and Maildev must already be running, and the API and worker must be up. See [Installing and Running](installing-and-running.md).

```bash
pnpm run test:e2e
```

`pnpm run test:e2e` loads `.env` through env-cmd. That file overrides variables already set in the shell.

## Docker

Bring up the compose stack, then run e2e from the host against the published API port:

```bash
pnpm run test:e2e:relational:docker
```

This starts the containers and does not delete the database volume.

---

Previous: [File uploading](file-uploading.md)

Next: [Benchmarking](benchmarking.md)
