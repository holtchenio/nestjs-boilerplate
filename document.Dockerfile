FROM node:24.14.1-alpine

RUN apk add --no-cache bash
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

COPY package.json pnpm-lock.yaml .npmrc /tmp/app/
RUN cd /tmp/app && pnpm install --frozen-lockfile

COPY . /usr/src/app
RUN cp -a /tmp/app/node_modules /usr/src/app
COPY ./wait-for-it.sh /opt/wait-for-it.sh
RUN chmod +x /opt/wait-for-it.sh
COPY ./startup.document.dev.sh /opt/startup.document.dev.sh
RUN chmod +x /opt/startup.document.dev.sh
RUN sed -i 's/\r//g' /opt/wait-for-it.sh
RUN sed -i 's/\r//g' /opt/startup.document.dev.sh

WORKDIR /usr/src/app
RUN if [ ! -f .env ]; then cp env-example-document .env; fi
RUN pnpm run build

CMD ["/opt/startup.document.dev.sh"]
