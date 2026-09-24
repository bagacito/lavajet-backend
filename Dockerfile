ARG NODE_VERSION=24.16.0

FROM node:${NODE_VERSION:-24}-alpine AS builder

RUN apk update && apk upgrade

#Temporary fix for undici
RUN cd /usr/local/lib/node_modules/npm/node_modules/node-gyp \
 && npm install undici@6.27.0 --no-save --package-lock=false --ignore-scripts
RUN rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/serialize-javascript \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/mocha \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici

ENV WORKDIR="lavajet-backend"

COPY ./src/ /$WORKDIR/src/
COPY ./tests/ /$WORKDIR/tests/
COPY ./workdocs /$WORKDIR/workdocs
COPY ./*.json /$WORKDIR/
COPY ./.npmrc /$WORKDIR/
COPY ./package.json /$WORKDIR/
COPY ./package-lock.json /$WORKDIR/


WORKDIR /$WORKDIR

RUN --mount=type=secret,id=TOKEN NPM_TOKEN=$(cat /run/secrets/TOKEN) npm ci

LABEL name="Pharmaledger's Lavajet Backend base image" description="The NestJS backend API for the Pharmaledger Lavajet Project - base image"


FROM builder AS builder-ew

RUN apk update && apk upgrade

#Temporary fix for undici
RUN cd /usr/local/lib/node_modules/npm/node_modules/node-gyp \
 && npm install undici@6.27.0 --no-save --package-lock=false --ignore-scripts
RUN rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/serialize-javascript \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/mocha \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici

ENV WORKDIR="lavajet-backend"

WORKDIR /$WORKDIR

RUN npm run build

LABEL name="Lavajet Backend base image" description="The NestJS backend API for the Pharmaledger Lavajet Project"


FROM builder AS builder-pla

RUN apk update && apk upgrade

#Temporary fix for undici
RUN cd /usr/local/lib/node_modules/npm/node_modules/node-gyp \
 && npm install undici@6.27.0 --no-save --package-lock=false --ignore-scripts
RUN rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/serialize-javascript \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/mocha \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici

ENV WORKDIR="lavajet-backend"

RUN mv /${WORKDIR}/src/app.module.ts /${WORKDIR}/src/app-ew.module.ts
RUN mv /${WORKDIR}/src/app-pla.module.ts /${WORKDIR}/src/app.module.ts

RUN npm run build

LABEL name="Lavajet Admin Lavajet Backend base image" description="The NestJS backend API for the Pharmaledger Lavajet Project"


FROM node:${NODE_VERSION:-24}-alpine AS production-ew

RUN apk update && apk upgrade
RUN apk --no-cache add htop less grep && apk add --no-cache --upgrade bash && apk --no-cache add curl

#Temporary fix for undici
RUN cd /usr/local/lib/node_modules/npm/node_modules/node-gyp \
 && npm install undici@6.27.0 --no-save --package-lock=false --ignore-scripts
RUN rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/serialize-javascript \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/mocha \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici

ENV WORKDIR="lavajet-backend"

ENV NODE_ENV="production"

COPY --from=builder-ew --chown=node:node /$WORKDIR/lib /$WORKDIR/lib
COPY --from=builder-ew --chown=node:node /$WORKDIR/workdocs/assets /$WORKDIR/workdocs/assets
COPY --from=builder-ew --chown=node:node /$WORKDIR/package*.json /$WORKDIR/
COPY --from=builder-ew --chown=node:node /$WORKDIR/.npmrc /$WORKDIR/

WORKDIR /$WORKDIR

RUN --mount=type=secret,id=TOKEN NPM_TOKEN=$(cat /run/secrets/TOKEN) npm ci

RUN rm -rf .npmrc
USER node

EXPOSE 3000/tcp

ENTRYPOINT ["node", "lib/main"]

LABEL name="Lavajet Backend" description="The NestJS backend API for the Pharmaledger Lavajet Project"

FROM node:${NODE_VERSION:-24}-alpine AS dev-ew

RUN apk update && apk upgrade
RUN apk --no-cache add docker-cli docker-cli-compose 
RUN apk --no-cache add htop less grep && apk add --no-cache --upgrade bash && apk --no-cache add curl
RUN apk update && apk upgrade
RUN --mount=type=secret,id=TOKEN NPM_TOKEN=$(cat /run/secrets/TOKEN) npm update -g npm

ENV WORKDIR="lavajet-backend"

ENV NODE_ENV="production"

COPY --from=builder-ew --chown=node:node /$WORKDIR/lib /$WORKDIR/lib
COPY --from=builder-ew --chown=node:node /$WORKDIR/workdocs/assets /$WORKDIR/workdocs/assets
COPY --from=builder-ew --chown=node:node /$WORKDIR/package*.json /$WORKDIR/
COPY --from=builder-ew --chown=node:node /$WORKDIR/.npmrc /$WORKDIR/

WORKDIR /$WORKDIR

RUN --mount=type=secret,id=TOKEN NPM_TOKEN=$(cat /run/secrets/TOKEN) npm ci

RUN rm -rf .npmrc
USER node

EXPOSE 3000/tcp

ENTRYPOINT ["node", "lib/main"]

LABEL name="Lavajet Backend" description="The NestJS backend API for the Pharmaledger Lavajet Project"

FROM node:${NODE_VERSION:-24}-alpine AS dev-pla

RUN apk update && apk upgrade
RUN apk --no-cache add docker-cli docker-cli-compose 
RUN apk --no-cache add htop less grep && apk add --no-cache --upgrade bash && apk --no-cache add curl

#Temporary fix for undici
RUN cd /usr/local/lib/node_modules/npm/node_modules/node-gyp \
 && npm install undici@6.27.0 --no-save --package-lock=false --ignore-scripts
RUN rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/serialize-javascript \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/mocha \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici

ENV WORKDIR="lavajet-backend"

ENV NODE_ENV="production"

COPY --from=builder-pla --chown=node:node /$WORKDIR/lib /$WORKDIR/lib
COPY --from=builder-pla --chown=node:node /$WORKDIR/workdocs/assets /$WORKDIR/workdocs/assets
COPY --from=builder-pla --chown=node:node /$WORKDIR/package*.json /$WORKDIR/
COPY --from=builder-pla --chown=node:node /$WORKDIR/.npmrc /$WORKDIR/

WORKDIR /$WORKDIR

RUN --mount=type=secret,id=TOKEN NPM_TOKEN=$(cat /run/secrets/TOKEN) npm ci

RUN rm -rf .npmrc
USER node

EXPOSE 3000/tcp

ENTRYPOINT ["node", "lib/main"]

LABEL name="Lavajet Admin Lavajet Backend" description="The NestJS backend API for the Pharmaledger Lavajet Project"


FROM node:${NODE_VERSION:-24}-alpine AS production-pla

RUN apk update && apk upgrade
RUN apk --no-cache add htop less grep && apk add --no-cache --upgrade bash && apk --no-cache add curl

#Temporary fix for undici
RUN cd /usr/local/lib/node_modules/npm/node_modules/node-gyp \
 && npm install undici@6.27.0 --no-save --package-lock=false --ignore-scripts
RUN rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/serialize-javascript \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/mocha \
 && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici

ENV WORKDIR="lavajet-backend"

ENV NODE_ENV="production"

COPY --from=builder-pla --chown=node:node /$WORKDIR/lib /$WORKDIR/lib
COPY --from=builder-pla --chown=node:node /$WORKDIR/workdocs/assets /$WORKDIR/workdocs/assets
COPY --from=builder-pla --chown=node:node /$WORKDIR/package*.json /$WORKDIR/
COPY --from=builder-pla --chown=node:node /$WORKDIR/.npmrc /$WORKDIR/

WORKDIR /$WORKDIR

RUN --mount=type=secret,id=TOKEN NPM_TOKEN=$(cat /run/secrets/TOKEN) npm ci
RUN --mount=type=secret,id=TOKEN NPM_TOKEN=$(cat /run/secrets/TOKEN) npm ci

RUN rm -rf .npmrc
USER node

EXPOSE 3000/tcp

ENTRYPOINT ["node", "lib/main"]

LABEL name="Lavajet Admin Lavajet Backend" description="The NestJS backend API for the Pharmaledger Lavajet Project"

