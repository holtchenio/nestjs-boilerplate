FROM node:24.14.1-alpine AS base
RUN apk add --no-cache bash openssl
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /usr/src/app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec prisma generate && pnpm run build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --from=build --chown=node:node /usr/src/app/package.json ./package.json
COPY --from=build --chown=node:node /usr/src/app/src/mail/mail-templates ./src/mail/mail-templates
RUN mkdir -p files && chown node:node files
USER node

FROM runtime AS api
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM runtime AS worker
CMD ["node", "dist/worker.js"]

FROM build AS migrator
USER node
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]
