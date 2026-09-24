# Environment

Every runtime value is read through the accumulated decaf `Environment` object. This
section is the inventory of variables the backend **actually consumes**, with the config
path, the derived environment variable name and where it is read. Cloud/instance defaults
are out of scope here and belong to the sibling SAA-1490 environment audit.

## How names are derived

decaf flattens the accumulated config path into an environment variable name by joining
the path segments with `__` (`ENV_PATH_DELIMITER`) and converting camelCase to
UPPER_SNAKE. Examples:

| Config path                          | Environment variable        |
|--------------------------------------|-----------------------------|
| `Environment.lavajet.basePublic`         | `LAVAJET__BASE__PUBLIC`         |
| `Environment.database.couchdb.host`  | `DATABASE__COUCHDB__HOST`   |
| `Environment.throttling.publicTtlMs` | `THROTTLING__PUBLIC_TTL_MS` |
| `Environment.jwt.secretKey`          | `JWT__SECRET_KEY`           |

`Environment` is `Env.accumulate(DefaultNestConfig)` where `DefaultNestConfig`
merges the toolkit `DefaultLavajetConfig` with the backend overrides in
`src/utils/environment.ts:68`. The PLA build additionally accumulates the toolkit
`DefaultAdminLavajetConfig`. Note that `src/utils/pla-environment.ts` defines a
`PlaEnvironment`/`DefaultNestConfig`, but nothing imports it — the PLA build uses
`Environment`/`AdminEnvironment` directly, so that file is currently dead code.

## HTTP / CORS / limits

| Config path                   | Env var                          | Default                       | Read at                                              |
|-------------------------------|----------------------------------|-------------------------------|------------------------------------------------------|
| `throttling.enabled`          | `THROTTLING__ENABLED`            | `true`                        | `src/app.module.ts:248`, `src/app-pla.module.ts:262` |
| `throttling.defaultTtlMs`     | `THROTTLING__DEFAULT_TTL_MS`     | `60000`                       | same                                                 |
| `throttling.defaultLimit`     | `THROTTLING__DEFAULT_LIMIT`      | `100`                         | same                                                 |
| `throttling.publicTtlMs`      | `THROTTLING__PUBLIC_TTL_MS`      | `60000`                       | `src/api/public/{owner,metadata,leaflet,validate}`   |
| `throttling.publicLimit`      | `THROTTLING__PUBLIC_LIMIT`       | `20`                          | same                                                 |
| `cors.enabled`                | `CORS__ENABLED`                  | `true`                        | `src/main.ts:62`                                     |
| `cors.origins`                | `CORS__ORIGINS`                  | `*`                           | `src/main.ts:59-66`                                  |
| `cors.verbs`                  | `CORS__VERBS`                    | `POST,GET,PUT,DELETE,OPTIONS` | `src/main.ts:67`                                     |
| `cors.headers`                | `CORS__HEADERS`                  | bearer/auth header list       | `src/main.ts:77`                                     |
| `limits.bodyParserJson`       | `LIMITS__BODY_PARSER_JSON`       | `30mb`                        | `src/main.ts:49`                                     |
| `limits.bodyParserUrlencoded` | `LIMITS__BODY_PARSER_URLENCODED` | `5mb`                         | `src/main.ts:53`                                     |
| `versionWhiteList`            | `VERSION_WHITE_LIST`             | `api\|api-json`               | `src/main.ts:37`                                     |
| `versionWhiteListSeperator`   | `VERSION_WHITE_LIST_SEPERATOR`   | `\|`                          | `src/main.ts:34`                                     |

The `.env` file defines `LIMITS__BODY_PARSER_URL`, which does not map to the
declared field `limits.bodyParserUrlencoded`; the consumed name is
`LIMITS__BODY_PARSER_URLENCODED`.

## Swagger

| Config path              | Env var                     | Default                                                           |
|--------------------------|-----------------------------|-------------------------------------------------------------------|
| `swagger.enabled`        | `SWAGGER__ENABLED`          | `true`                                                            |
| `swagger.title`          | `SWAGGER__TITLE`            | `PharmaLedger™ ePI API`                                           |
| `swagger.description`    | `SWAGGER__DESCRIPTION`      | `Secure and scalable digital connection for product information.` |
| `swagger.assetsPath`     | `SWAGGER__ASSETS_PATH`      | `../workdocs/assets`                                              |
| `swagger.faviconPath`    | `SWAGGER__FAVICON_PATH`     | `Icon.png`                                                        |
| `swagger.topbarIconPath` | `SWAGGER__TOPBAR_ICON_PATH` | `Banner.png`                                                      |
| `swagger.topbarBgColor`  | `SWAGGER__TOPBAR_BG_COLOR`  | `#102c58`                                                         |

Read in `src/main.ts:58-146`. The `docker-compose.yml` service sets
`SWAGGER__DESCRIPTION` as an inline environment value.

## Authentication

| Config path     | Env var           | Default | Read at                                                   |
|-----------------|-------------------|---------|-----------------------------------------------------------|
| `jwt.secretKey` | `JWT__SECRET_KEY` | `""`    | `src/auth/jwtService.ts:18`, `src/utils/JwtUtils.ts`      |
| `jwt.expiry`    | `JWT__EXPIRY`     | `5m`    | `src/auth/jwtService.ts:19`                               |
| `verifyToken`   | `VERIFY_TOKEN`    | `""`    | `src/auth/keycloakAuthHandler.ts:276,447`, `src/kibana/*` |
| `verifyUrl`     | `VERIFY_URL`      | `""`    | `src/auth/jwtService.ts:20`                               |

The checked-in `.env` defines `JWT__EXPIRATION`, which does **not** map to the
declared field `jwt.expiry`; the consumed variable is `JWT__EXPIRY`. Flag for the
SAA-1490 env audit.

`VERIFY_TOKEN` is the global auth switch: when falsy, the Fabric/Keycloak handler
and the Kibana guard bypass identity verification (`src/auth/keycloakAuthHandler.ts:447`,
`src/kibana/kibana-session.guard.ts:37`).

## Fabric

| Config path                      | Env var                               | Default                            |
|----------------------------------|---------------------------------------|------------------------------------|
| `fabric.cryptoPath`              | `FABRIC__CRYPTO_PATH`                 | `../toolkit/docker/docker-data`    |
| `fabric.keyCertOrDirectoryPath`  | `FABRIC__KEY_CERT_OR_DIRECTORY_PATH`  | toolkit path                       |
| `fabric.certCertOrDirectoryPath` | `FABRIC__CERT_CERT_OR_DIRECTORY_PATH` | toolkit path                       |
| `fabric.tlsCert`                 | `FABRIC__TLS_CERT`                    | toolkit path                       |
| `fabric.peerEndpoint`            | `FABRIC__PEER_ENDPOINT`               | `org-a-peer-0:7031`                |
| `fabric.peerHostAlias`           | `FABRIC__PEER_HOST_ALIAS`             | `org-a-peer-0`                     |
| `fabric.chaincodeName`           | `FABRIC__CHAINCODE_NAME`              | `lavajet-contract`                     |
| `fabric.ca`                      | `FABRIC__CA`                          | `org-a`                            |
| `fabric.mspId`                   | `FABRIC__MSP_ID`                      | `Peer0OrgaMSP`                     |
| `fabric.channel`                 | `FABRIC__CHANNEL`                     | `simple-channel`                   |
| `fabric.preferLegacy`            | `FABRIC__PREFER_LEGACY`               | `true` (EW `allowGatewayOverride`) |
| `fabric.onPremChannel`           | `FABRIC__ON_PREM_CHANNEL`             | `on-prem-channel`                  |
| `fabric.onPremChaincodeName`     | `FABRIC__ON_PREM_CHAINCODE_NAME`      | `lavajet-on-prem-contract`             |

Read in `src/app.module.ts:137-149` and `src/app-pla.module.ts:142-152`.

The MSP map is read directly from `process.env`, because an indexed map cannot
be expressed as a decaf path:

* EW: `FABRIC__MSP_MAP__BAGACITOMSP__{0,1,2}__{ENDPOINT,ALIAS,TLS_CERT}`
  (`src/app.module.ts:155-193`).
* PLA: `FABRIC__MSP_MAP__{0,1,2}__{ENDPOINT,ALIAS,TLS_CERT}`
  (`src/app-pla.module.ts:158-187`).

The remaining `FABRIC__*` values in `.env` (`TLS_VERIFY`, `CA_ENDPOINT`,
`EVALUATE_TIMEOUT`, `ENDORSE_TIMEOUT`, `SUBMIT_TIMEOUT`, `COMMIT_TIMEOUT`, `HSM`)
belong to the toolkit adapter and are read by the toolkit, not by backend code.

## Databases

| Config path                     | Env var                           | Default           | Notes                                             |
|---------------------------------|-----------------------------------|-------------------|---------------------------------------------------|
| `database.couchdb.user`         | `DATABASE__COUCHDB__USER`         | `admin`           | credential store                                  |
| `database.couchdb.password`     | `DATABASE__COUCHDB__PASSWORD`     | `admin-pw`        | credential store                                  |
| `database.couchdb.host`         | `DATABASE__COUCHDB__HOST`         | `localhost`       |                                                   |
| `database.couchdb.port`         | `DATABASE__COUCHDB__PORT`         | `5984`            |                                                   |
| `database.couchdb.database`     | `DATABASE__COUCHDB__DATABASE`     | `lavajet-credentials` |                                                   |
| `database.couchdb.protocol`     | `DATABASE__COUCHDB__PROTOCOL`     | `http`            |                                                   |
| `tasks.user`                    | `TASKS__USER`                     | `tasks`           | task engine                                       |
| `tasks.password`                | `TASKS__PASSWORD`                 | `tasks`           | task engine                                       |
| `tasks.database`                | `TASKS__DATABASE`                 | `tasks`           | task engine                                       |
| `database.postgres.host`        | `DATABASE__POSTGRES__HOST`        | `postgres`        | PLA only                                          |
| `database.postgres.port`        | `DATABASE__POSTGRES__PORT`        | `5432`            | PLA only                                          |
| `database.postgres.database`    | `DATABASE__POSTGRES__DATABASE`    | `""`              | PLA only                                          |
| `database.postgres.user`        | `DATABASE__POSTGRES__USER`        | `""`              | PLA only                                          |
| `database.postgres.password`    | `DATABASE__POSTGRES__PASSWORD`    | `""`              | PLA only                                          |
| `database.postgres.synchronize` | `DATABASE__POSTGRES__SYNCHRONIZE` | `true`            | PLA only; must be `false` in managed environments |

`src/.test.env` sets `DATABASE__POSTGRES__{DATABASE,USER,PASSWORD,HOST,PORT}`
for the test suite.

## Application behaviour

| Config path                            | Env var                                    | Default             | Read at                                                                                                     |
|----------------------------------------|--------------------------------------------|---------------------|-------------------------------------------------------------------------------------------------------------|
| `mode`                                 | `MODE`                                     | `""`                | `src/interceptors/server-state.interceptor.ts:21`, `src/api/infrastructure/infrastructure.controller.ts:39` |
| `token`                                | `TOKEN`                                    | `""`                | `src/interceptors/token.interceptor.ts:23`                                                                  |
| `automaticContractUpdate`              | `AUTOMATIC_CONTRACT_UPDATE`                | `false`             | `src/api/infrastructure/infrastructure.controller.ts:54`                                                    |
| `onPremContractPort`                   | `ON_PREM_CONTRACT_PORT`                    | `8480`              | `src/api/infrastructure/infrastructure.controller.ts:62`                                                    |
| `epiContractPort`                      | `EPI_CONTRACT_PORT`                        | `8470`              | `src/api/infrastructure/infrastructure.controller.ts:63`                                                    |
| `scans.allowMissingBatch`              | `SCANS__ALLOW_MISSING_BATCH`               | `false`             | `src/api/public/metadata/metadata.controller.ts:61`                                                         |
| `resolver.cronTime.long`               | `RESOLVER__CRON_TIME__LONG`                | `0 */20 * * * *`    | `src/utils/ResolverTaskService.ts:17`                                                                       |
| `resolver.cronTime.short`              | `RESOLVER__CRON_TIME__SHORT`               | `0 */10 * * * *`    | `src/utils/ResolverTaskService.ts:28`                                                                       |
| `serviceAccount`                       | `SERVICE_ACCOUNT`                          | `service.account@…` | `src/api/leaflet-resolver/leaflet-resolver.controller.ts:25,36`, `src/utils/ResolverTaskService.ts:24,35`   |
| `lavajet.host`                             | `LAVAJET__HOST`                                | `localhost:3000`    | `src/api/public/logUtils.ts:32`                                                                             |
| `lavajet.port`                             | `LAVAJET__PORT`                                | (unset)             | `src/api/public/logUtils.ts:29`                                                                             |
| `lavajet.protocol`                         | `LAVAJET__PROTOCOL`                            | `http`              | `src/api/public/logUtils.ts:32`                                                                             |
| `lavajet.basePublic`                       | `LAVAJET__BASE__PUBLIC`                        | `public`            | public URL composition                                                                                      |
| `keycloak.identityProviderDisplayName` | `KEYCLOAK__IDENTITY_PROVIDER_DISPLAY_NAME` | `""`                | `src/api/account/account-pla.controller.ts:76`                                                              |

## Kibana

`src/kibana/kibana-middleware.ts:24-33` destructures the whole
`Environment.kibana` object, so all of its fields are consumed:

| Config path               | Env var                      |
|---------------------------|------------------------------|
| `kibana.host`             | `KIBANA__HOST`               |
| `kibana.es_host`          | `KIBANA__ES_HOST`            |
| `kibana.hostProtocol`     | `KIBANA__HOST_PROTOCOL`      |
| `kibana.realm`            | `KIBANA__REALM`              |
| `kibana.adminApiUsername` | `KIBANA__ADMIN_API_USERNAME` |
| `kibana.adminApiPassword` | `KIBANA__ADMIN_API_PASSWORD` |
| `kibana.realmApiUsername` | `KIBANA__REALM_API_USERNAME` |
| `kibana.realmApiPassword` | `KIBANA__REALM_API_PASSWORD` |
| `kibana.topMenu`          | `KIBANA__TOP_MENU`           |
| `kibana.queryInput`       | `KIBANA__QUERY_INPUT`        |
| `kibana.refreshInterval`  | `KIBANA__REFRESH_INTERVAL`   |
| `kibana.dashboard`        | `KIBANA__DASHBOARD`          |
| `kibana.dashboards`       | `KIBANA__DASHBOARDS`         |
| `kibana.assets`           | `KIBANA__ASSETS`             |

## Direct `process.env` reads

These cannot be expressed as decaf paths and are read directly:

| Variable                | Default                | Read at                                              | Purpose                                                      |
|-------------------------|------------------------|------------------------------------------------------|--------------------------------------------------------------|
| `LOCAL_NEST_PORT`       | `3000`                 | `src/main.ts:146`                                    | Local listen port override.                                  |
| `MIGRATIONS__LOCK_FILE` | `./locks/version.lock` | `src/cli-module.ts:29`                               | Migration lock file path.                                    |
| `ORG_DOMAIN`            | `lavajet.internal`         | `src/api/public/validate/validate.controller.ts:46`  | Builds the organisation endpoint for token validation (PLA). |
| `FABRIC__MSP_MAP__…`    | localhost peers        | `src/app.module.ts:155`, `src/app-pla.module.ts:158` | Indexed Fabric peer map.                                     |

## Secret variables

These are read through the same `Environment` object but are expected to be injected
from the cluster secret store, never committed:

`DATABASE__COUCHDB__ADMIN`, `DATABASE__COUCHDB__ADMIN_PASSWORD`,
`DATABASE__COUCHDB__PASSWORD`, `DATABASE__COUCHDB__READ_USER`,
`DATABASE__COUCHDB__READ_PASSWORD`, `JWT__SECRET_KEY`, `TASKS__USER`,
`TASKS__PASSWORD`, `CACHE__USER`, `CACHE__PASSWORD`,
`STORAGE__ROOT_PASSWORD`, `DATABASE__POSTGRES__USER`,
`DATABASE__POSTGRES__PASSWORD`, `KEYCLOAK__*` credentials,
`KIBANA__ADMIN_API_USERNAME`, `KIBANA__ADMIN_API_PASSWORD`,
`KIBANA__REALM_API_USERNAME`, `KIBANA__REALM_API_PASSWORD`.

The full secret inventory is `.env.secret` / `.env.example` at the workspace root.
