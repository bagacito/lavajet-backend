# PLA Backend Environment Variables

This document outlines the environment variables used by the PLA backend application. This application uses the `AdminLavajetConfig` from the toolkit, which includes all variables from the base `LavajetConfig` plus additional ones for infrastructure management.

## Base Configuration

These variables are inherited from the Lavajet Toolkit.

| Variable        | Default Value                           | Accepted Values                   | Description                     |
|-----------------|-----------------------------------------|-----------------------------------|---------------------------------|
| `APP`           | `lavajet`                                | string                            | The name of the application.    |
| `ENV`           | `development`                           | `development`, `production`, etc. | The application environment.    |
| `PROJECT_SHORT` | `Lavajet`                                   | string                            | A short name for the project.   |
| `PROJECT_LONG`  | `PharmaLedger™ Trusted Partner Program` | string                            | A long name for the project.    |
| `ORG_NAME`      | `bagacito`                     | string                            | The name of the organization.   |
| `ORG_DOMAIN`    | `lavajet.internal`                          | string                            | The domain of the organization. |

## Lavajet Configuration

| Variable           | Default Value    | Accepted Values | Description                          |
|--------------------|------------------|-----------------|--------------------------------------|
| `LAVAJET__HOST`        | `localhost:3000` | string          | The hostname of the Lavajet application. |
| `LAVAJET__PROTOCOL`    | `http`           | `http`, `https` | The protocol of the Lavajet application. |
| `LAVAJET__BASE_PUBLIC` | `public`         | string          | The base public path.                |

## Task Management

| Variable                              | Default Value | Accepted Values | Description                                        |
|---------------------------------------|---------------|-----------------|----------------------------------------------------|
| `TASKS__DATABASE`                     | `tasks`       | string          | The name of the tasks database.                    |
| `TASKS__FLAVOUR`                      | `nano`        | string          | The flavour of the tasks database.                 |
| `TASKS__USER`                         | `tasks`       | string          | The username for the tasks database.               |
| `TASKS__PASSWORD`                     | `tasks`       | string          | The password for the tasks database.               |
| `TASKS__WORKER_ID`                    | `task-runner` | string          | The ID of the task runner worker.                  |
| `TASKS__CONCURRENCY`                  | `2`           | number          | The number of concurrent tasks.                    |
| `TASKS__LEASE_MS`                     | `60000`       | number          | The lease time in milliseconds.                    |
| `TASKS__POLL_MS_IDLE`                 | `1000`        | number          | The polling interval in milliseconds when idle.    |
| `TASKS__POLL_MS_BUSY`                 | `500`         | number          | The polling interval in milliseconds when busy.    |
| `TASKS__LOG_TAIL_MAX`                 | `100`         | number          | The maximum number of log lines to tail.           |
| `TASKS__STREAM_BUFFER_SIZE`           | `5`           | number          | The size of the stream buffer.                     |
| `TASKS__MAX_LOGGING_BUFFER`           | `300`         | number          | The maximum size of the logging buffer.            |
| `TASKS__LOGGING_BUFFER_TRUNCATION`    | `20`          | number          | The truncation size of the logging buffer.         |
| `TASKS__GRACEFUL_SHUTDOWN_MS_TIMEOUT` | `3600000`     | number          | The timeout for graceful shutdown in milliseconds. |

## Keycloak Configuration

| Variable                                    | Default Value             | Accepted Values | Description                                                                                                                                                                                                                                                                        |
|---------------------------------------------|---------------------------|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `KEYCLOAK__POSTGRES__USER`                  | `PLAuser`                 | string          | The username for the Keycloak PostgreSQL database.                                                                                                                                                                                                                                 |
| `KEYCLOAK__POSTGRES__PASSWORD`              | `PLApassword`             | string          | The password for the Keycloak PostgreSQL database.                                                                                                                                                                                                                                 |
| `KEYCLOAK__POSTGRES__DATABASE`              | `PLApostgresDB`           | string          | The name of the Keycloak PostgreSQL database.                                                                                                                                                                                                                                      |
| `KEYCLOAK__INTERNAL_HOST`                   | `keycloak`                | string          | The internal hostname of Keycloak.                                                                                                                                                                                                                                                 |
| `KEYCLOAK__INTERNAL_PORT`                   | `8080`                    | number          | The internal port of Keycloak.                                                                                                                                                                                                                                                     |
| `KEYCLOAK__HOST`                            | `keycloak.lavajet.internal`   | string          | The public hostname of Keycloak.                                                                                                                                                                                                                                                   |
| `KEYCLOAK__HOST_PROTOCOL`                   | `https`                   | `http`, `https` | The protocol for the Keycloak host.                                                                                                                                                                                                                                                |
| `KEYCLOAK__ROOT_USERNAME`                   |                           | string          | The root username for Keycloak.                                                                                                                                                                                                                                                    |
| `KEYCLOAK__ROOT_PASSWORD`                   |                           | string          | The root password for Keycloak.                                                                                                                                                                                                                                                    |
| `KEYCLOAK__ADMIN_REALM`                     | `master`                  | string          | The admin realm in Keycloak.                                                                                                                                                                                                                                                       |
| `KEYCLOAK__ADMIN_API_CLIENT_ID`             | `admin-cli`               | string          | The admin API client ID.                                                                                                                                                                                                                                                           |
| `KEYCLOAK__ADMIN_API_USERNAME`              | `api-admin`               | string          | The admin API username.                                                                                                                                                                                                                                                            |
| `KEYCLOAK__ADMIN_API_PASSWORD`              |                           | string          | The admin API password.                                                                                                                                                                                                                                                            |
| `KEYCLOAK__REALM`                           | `bagacito`       | string          | The realm in Keycloak.                                                                                                                                                                                                                                                             |
| `KEYCLOAK__REALM_API_CLIENT_ID`             | `admin-cli`               | string          | The realm API client ID.                                                                                                                                                                                                                                                           |
| `KEYCLOAK__REALM_API_USERNAME`              | `api-admin`               | string          | The realm API username.                                                                                                                                                                                                                                                            |
| `KEYCLOAK__REALM_API_PASSWORD`              |                           | string          | The realm API password.                                                                                                                                                                                                                                                            |
| `KEYCLOAK__CLIENT_ID`                       | `bagacito-oauth` | string          | The client ID.                                                                                                                                                                                                                                                                     |
| `KEYCLOAK__CLIENT_NAME`                     |                           | string          | The client name.                                                                                                                                                                                                                                                                   |
| `KEYCLOAK__CLIENT_DESCRIPTION`              |                           | string          | The client description.                                                                                                                                                                                                                                                            |
| `KEYCLOAK__CLIENT_SECRET`                   |                           | string          | The client secret.                                                                                                                                                                                                                                                                 |
| `KEYCLOAK__CLIENT_ROOT_URL`                 |                           | string          | The client root URL.                                                                                                                                                                                                                                                               |
| `KEYCLOAK__CLIENT_ADMIN_URL`                |                           | string          | The client admin URL.                                                                                                                                                                                                                                                              |
| `KEYCLOAK__CLIENT_BASE_URL`                 |                           | string          | The client base URL.                                                                                                                                                                                                                                                               |
| `KEYCLOAK__DEFAULT_SEPARATOR`               | `                         | `               | string                                                                                                                                                                                                                                                                             | The default separator. |
| `KEYCLOAK__CLIENT_REDIRECT_URIS`            | `*`                       | string          | The client redirect URIs.                                                                                                                                                                                                                                                          |
| `KEYCLOAK__CLIENT_WEB_ORIGINS`              | `*`                       | string          | The client web origins.                                                                                                                                                                                                                                                            |
| `KEYCLOAK__CLIENT_ROLES`                    |                           | string          | A comma-separated list of client roles. These are mapped to the SSO-assigned roles. For the PLA, this should include mappings for `epi-writer`, `epi-reader`, `epi-admin`, `pla-admin`, `pla-writer`, and `pla-reader`. Example: `sso-epi-admin:epi-admin,sso-pla-admin:pla-admin` |
| `KEYCLOAK__CLIENT_ROLE_SEPARATOR`           | `:`                       | string          | The separator used within a role mapping.                                                                                                                                                                                                                                          |
| `KEYCLOAK__CLIENT_ROLES_SEPARATOR`          | `                         | `               | string                                                                                                                                                                                                                                                                             | The separator used between role mappings. |
| `KEYCLOAK__IDENTITY_PROVIDER_ALIAS`         | `bagacito_oidc`  | string          | The alias for the identity provider, used to uniquely identify it (e.g., `azure-ad`).                                                                                                                                                                                              |
| `KEYCLOAK__IDENTITY_PROVIDER_DISPLAY_NAME`  | `Bagacito OIDC`  | string          | The display name for the identity provider, shown on the login page.                                                                                                                                                                                                               |
| `KEYCLOAK__IDENTITY_PROVIDER_TENANT_ID`     |                           | string          | The Tenant ID for the Azure AD identity provider.                                                                                                                                                                                                                                  |
| `KEYCLOAK__IDENTITY_PROVIDER_CLIENT_ID`     |                           | string          | The Client ID for the identity provider application.                                                                                                                                                                                                                               |
| `KEYCLOAK__IDENTITY_PROVIDER_CLIENT_SECRET` |                           | string          | The Client Secret for the identity provider application.                                                                                                                                                                                                                           |

## Kibana Configuration

| Variable                     | Default Value                          | Accepted Values | Description                               |
|------------------------------|----------------------------------------|-----------------|-------------------------------------------|
| `KIBANA__HOST`               | `kibana.lavajet.internal`                  | string          | The hostname of Kibana.                   |
| `KIBANA__ES_HOST`            | `es.lavajet.internal`                      | string          | The hostname of Elasticsearch for Kibana. |
| `KIBANA__HOST_PROTOCOL`      | `https`                                | `http`, `https` | The protocol for the Kibana host.         |
| `KIBANA__ADMIN_API_USERNAME` |                                        | string          | The admin API username for Kibana.        |
| `KIBANA__ADMIN_API_PASSWORD` |                                        | string          | The admin API password for Kibana.        |
| `KIBANA__REALM`              | `bagacito`                    | string          | The realm in Kibana.                      |
| `KIBANA__REALM_API_USERNAME` |                                        | string          | The realm API username for Kibana.        |
| `KIBANA__REALM_API_PASSWORD` |                                        | string          | The realm API password for Kibana.        |
| `KIBANA__DASHBOARD`          | `adb3eea0-6a50-40c8-8c36-2352d961dcbc` | string          | The Kibana dashboard.                     |
| `KIBANA__REFRESH_INTERVAL`   | `60000`                                | number          | The refresh interval in milliseconds.     |
| `KIBANA__TOP_MENU`           | `false`                                | boolean         | Whether to show the top menu.             |
| `KIBANA__QUERY_INPUT`        | `true`                                 | boolean         | Whether to show the query input.          |
| `KIBANA__TIME_FILTER`        | `true`                                 | boolean         | Whether to show the time filter.          |
| `KIBANA__ASSETS`             | `assets/dashboards`                    | string          | The path to Kibana assets.                |

## Cache Configuration

| Variable          | Default Value    | Accepted Values | Description                 |
|-------------------|------------------|-----------------|-----------------------------|
| `CACHE__URL`      | `localhost:6379` | string          | The URL of the cache.       |
| `CACHE__USERNAME` |                  | string          | The username for the cache. |
| `CACHE__PASSWORD` |                  | string          | The password for the cache. |

## Database Configuration

| Variable                            | Default Value     | Accepted Values | Description                               |
|-------------------------------------|-------------------|-----------------|-------------------------------------------|
| `DATABASE__POSTGRES__HOST`          | `postgres`        | string          | The hostname of the PostgreSQL database.  |
| `DATABASE__POSTGRES__PORT`          | `5432`            | number          | The port of the PostgreSQL database.      |
| `DATABASE__POSTGRES__DATABASE`      |                   | string          | The name of the PostgreSQL database.      |
| `DATABASE__POSTGRES__USER`          |                   | string          | The username for the PostgreSQL database. |
| `DATABASE__POSTGRES__PASSWORD`      |                   | string          | The password for the PostgreSQL database. |
| `DATABASE__COUCHDB__USER`           | `admin`           | string          | The username for CouchDB.                 |
| `DATABASE__COUCHDB__PASSWORD`       | `admin-pw`        | string          | The password for CouchDB.                 |
| `DATABASE__COUCHDB__PORT`           | `5984`            | number          | The port of CouchDB.                      |
| `DATABASE__COUCHDB__HOST`           | `localhost`       | string          | The hostname of CouchDB.                  |
| `DATABASE__COUCHDB__PROTOCOL`       | `http`            | `http`, `https` | The protocol for CouchDB.                 |
| `DATABASE__COUCHDB__DATABASE`       | `lavajet-credentials` | string          | The name of the CouchDB database.         |

## Fabric Configuration

| Variable                              | Default Value                                       | Accepted Values | Description                                   |
|---------------------------------------|-----------------------------------------------------|-----------------|-----------------------------------------------|
| `FABRIC__ALLOW_GATEWAY_OVERRIDE`      | `false`                                             | boolean         | Whether to allow gateway override.            |
| `FABRIC__CRYPTO_PATH`                 | `../toolkit/docker/docker-data`                     | string          | The path to the crypto material.              |
| `FABRIC__KEY_CERT_OR_DIRECTORY_PATH`  | `../toolkit/docker/docker-data/admin/msp/keystore`  | string          | The path to the key certificate or directory. |
| `FABRIC__CERT_CERT_OR_DIRECTORY_PATH` | `../toolkit/docker/docker-data/admin/msp/signcerts` | string          | The path to the certificate or directory.     |
| `FABRIC__TLS_CERT`                    | `../toolkit/docker/docker-data/tls-ca-cert.pem`     | string          | The path to the TLS certificate.              |
| `FABRIC__TLS_VERIFY`                  | `true`                                              | boolean         | Whether to verify the TLS certificate.        |
| `FABRIC__PEER_ENDPOINT`               | `org-a-peer-0:7031`                                 | string          | The endpoint of the peer.                     |
| `FABRIC__PEER_HOST_ALIAS`             | `org-a-peer-0`                                      | string          | The host alias of the peer.                   |
| `FABRIC__CHAINCODE_NAME`              | `lavajet-contract`                                      | string          | The name of the chaincode.                    |
| `FABRIC__CA_ENDPOINT`                 | `org-a-ca:7011`                                     | string          | The endpoint of the CA.                       |
| `FABRIC__CA`                          | `org-a`                                             | string          | The name of the CA.                           |
| `FABRIC__MSP_ID`                      | `Peer0OrgaMSP`                                      | string          | The MSP ID.                                   |
| `FABRIC__CHANNEL`                     | `simple-channel`                                    | string          | The name of the channel.                      |
| `FABRIC__SIZE_LIMIT`                  | `15`                                                | number          | The size limit.                               |
| `FABRIC__EVALUATE_TIMEOUT`            | `5`                                                 | number          | The evaluate timeout in seconds.              |
| `FABRIC__ENDORSE_TIMEOUT`             | `15`                                                | number          | The endorse timeout in seconds.               |
| `FABRIC__SUBMIT_TIMEOUT`              | `5`                                                 | number          | The submit timeout in seconds.                |
| `FABRIC__COMMIT_TIMEOUT`              | `60`                                                | number          | The commit timeout in seconds.                |

## Client Configuration

| Variable              | Default Value | Accepted Values | Description                    |
|-----------------------|---------------|-----------------|--------------------------------|
| `CLIENT__PRIVATE_KEY` |               | string          | The private key of the client. |
| `CLIENT__PUBLIC_KEY`  |               | string          | The public key of the client.  |

## CORS Configuration

| Variable        | Default Value | Accepted Values | Description              |
|-----------------|---------------|-----------------|--------------------------|
| `CORS__ENABLED` | `true`        | boolean         | Whether CORS is enabled. |
| `CORS__ORIGINS` | `*`           | string          | The allowed origins.     |

## JWT Configuration

| Variable          | Default Value | Accepted Values | Description              |
|-------------------|---------------|-----------------|--------------------------|
| `JWT__SECRET_KEY` |               | string          | The secret key for JWT.  |
| `JWT__EXPIRY`     | `5m`          | string          | The expiry time for JWT. |

## Deployment Configuration

| Variable                                 | Default Value                                              | Accepted Values | Description                             |
|------------------------------------------|------------------------------------------------------------|-----------------|-----------------------------------------|
| `DEPLOYMENT__PLATFORM`                   | `docker`                                                   | `docker`, etc.  | The deployment platform.                |
| `DEPLOYMENT__DOCKER__DOCKER_SOCKET_PATH` | `/var/run/docker.sock`                                     | string          | The path to the Docker socket.          |
| `DEPLOYMENT__DOCKER__IMAGE`              | `ghcr.io/bagacito/lavajet-infrastructure:jest-latest` | string          | The Docker image to use for deployment. |

## Admin Configuration

| Variable                                       | Default Value                                                     | Accepted Values | Description                                            |
|------------------------------------------------|-------------------------------------------------------------------|-----------------|--------------------------------------------------------|
| `ROLES__TOKEN`                                 | `pla-admin`                                                       | string          | The token for roles.                                   |
| `ROLES__ACCOUNT`                               |                                                                   | string          | The account for roles.                                 |
| `INFRASTRUCTURE__CONNECTOR`                    | `GitHubInfrastructureConnector`                                   | string          | The infrastructure connector to use.                   |
| `INFRASTRUCTURE__ENABLE_COLLECTIONS`           | `true`                                                            | boolean         | Whether to enable collections.                         |
| `INFRASTRUCTURE__ONBOARD__DOCKER_COMPOSE_PATH` | `../../docker/org-docker-compose.yaml`                            | string          | The path to the Docker Compose file for onboarding.    |
| `INFRASTRUCTURE__PATHS__ONBOARDING`            | `../infra/tests/infrastructure/onboard-partner.setup.ts`          | string          | The path to the onboarding script.                     |
| `INFRASTRUCTURE__PATHS__BOOT_INFRASTRUCTURE`   | `../infra/tests/infrastructure/boot-infrastructure.setup.ts`      | string          | The path to the boot infrastructure script.            |
| `INFRASTRUCTURE__PATHS__COUCHDB`               | `../infra/tests/infrastructure/k8s/init-couchdb.test.cjs`         | string          | The path to the CouchDB initialization script.         |
| `INFRASTRUCTURE__IMAGES__TOOLS`                | `dregistry.pdmfc.com/decaf-ts/fabric-weaver:weaver-2.5.12-latest` | string          | The Docker image for tools.                            |
| `INFRASTRUCTURE__IMAGES__TLS`                  | `ghcr.io/bagacito/lavajet-infrastructure:fabric-ca-latest`   | string          | The Docker image for TLS.                              |
| `INFRASTRUCTURE__IMAGES__CA`                   | `ghcr.io/bagacito/lavajet-infrastructure:fabric-ca-latest`   | string          | The Docker image for the CA.                           |
| `INFRASTRUCTURE__IMAGES__PEER`                 | `ghcr.io/bagacito/lavajet-infrastructure:fabric-peer-latest` | string          | The Docker image for the peer.                         |
| `INFRASTRUCTURE__IMAGES__CONTRACT`             | `ghcr.io/bagacito/lavajet-toolkit:contract-latest`           | string          | The Docker image for the contract.                     |
| `INFRASTRUCTURE__IMAGES__COUCHDB`              | `couchdb:latest`                                                  | string          | The Docker image for CouchDB.                          |
| `INFRASTRUCTURE__IMAGES__OAUTH`                | `quay.io/oauth2-proxy/oauth2-proxy:v7.13.0`                       | string          | The Docker image for OAuth.                            |
| `INFRASTRUCTURE__IMAGES__FRONTEND`             | `ghcr.io/bagacito/lavajet-frontend:latest`                | string          | The Docker image for the frontend.                     |
| `INFRASTRUCTURE__IMAGES__DRAGONFLY`            | `ghcr.io/bagacito/lavajet-infrastructure:dragonfly-latest`   | string          | The Docker image for Dragonfly.                        |
| `INFRASTRUCTURE__IMAGES__REDIS_COMMANDER`      | `rediscommander/redis-commander:latest`                           | string          | The Docker image for Redis Commander.                  |
| `INFRASTRUCTURE__ORG__COUNTRY`                 | `GB`                                                              | string          | The country of the organization.                       |
| `INFRASTRUCTURE__ORG__STATE`                   | `Greater London`                                                  | string          | The state of the organization.                         |
| `INFRASTRUCTURE__ORG__LOCALITY`                | `London`                                                          | string          | The locality of the organization.                      |
| `INFRASTRUCTURE__ORG__ORGANIZATION`            | `Pharmaledger Association`                                        | string          | The name of the organization.                          |
| `INFRASTRUCTURE__ORG__ORGANIZATION_UNIT`       | `Fabric for Pharmaledger`                                         | string          | The organization unit.                                 |
| `INFRASTRUCTURE__PLA__TLS_PORT`                | `7000`                                                            | number          | The TLS port for PLA.                                  |
| `INFRASTRUCTURE__PLA__ORDERER_HOST`            | `bagacito-orderer-0`                                     | string          | The orderer host for PLA.                              |
| `INFRASTRUCTURE__PLA__ORDERER_PORT`            | `7020`                                                            | number          | The orderer port for PLA.                              |
| `INFRASTRUCTURE__PLA__PEER_HOST`               | `bagacito-peer-0`                                        | string          | The peer host for PLA.                                 |
| `INFRASTRUCTURE__PLA__TOOLS_HOST`              | `bagacito-tools`                                         | string          | The tools host for PLA.                                |
| `INFRASTRUCTURE__PLA__CONTRACT_PORT`           | `7070`                                                            | number          | The contract port for PLA.                             |
| `INFRASTRUCTURE__PLA__DOCKER_COMPOSE_PATH`     | `../../docker/pla-docker-compose.yaml`                            | string          | The path to the Docker Compose file for PLA.           |
| `INFRASTRUCTURE__JEST__CONFIG_PATH`            |                                                                   | string          | The path to the Jest config file.                      |
| `INFRASTRUCTURE__JEST__TSCONFIG_PATH`          |                                                                   | string          | The path to the tsconfig file for Jest.                |
| `INFRASTRUCTURE__CONTRACT__PORT`               | `7070`                                                            | number          | The port for the contract.                             |
| `INFRASTRUCTURE__CONTRACT__VERSION`            | `1.0`                                                             | string          | The version of the contract.                           |
| `INFRASTRUCTURE__CONTRACT__TAG`                | `latest`                                                          | string          | The tag of the contract.                               |
| `GITHUB_TOKEN`                                 |                                                                   | string          | The GitHub token.                                      |
| `COOKIE_EXPIRY`                                | `6h`                                                              | string          | The cookie expiry time.                                |
| `COOKIE_REFRESH`                               | `3m`                                                              | string          | The cookie refresh time.                               |
| `KEYCLOAK_HOSTNAME`                            | `keycloak.lavajet.internal`                                           | string          | The hostname of Keycloak.                              |
| `OAUTH2_PROXY_COOKIE_SECRET`                   |                                                                   | string          | The cookie secret for the OAuth2 proxy.                |
| `OAUTH2_PROXY_COOKIE_DOMAINS`                  |                                                                   | string          | The cookie domains for the OAuth2 proxy.               |
| `OAUTH2_PROXY_WHITELIST_DOMAINS`               |                                                                   | string          | The whitelist domains for the OAuth2 proxy.            |
| `OAUTH2_PROXY_PROVIDER`                        |                                                                   | string          | The provider for the OAuth2 proxy.                     |
| `OAUTH2_PROXY_EMAIL_DOMAINS`                   |                                                                   | string          | The email domains for the OAuth2 proxy.                |
| `OAUTH2_PROXY_REALM`                           |                                                                   | string          | The realm for the OAuth2 proxy.                        |
| `RUNNING_IN_LOCAL_MACHINE`                     | `false`                                                           | boolean         | Whether the application is running in a local machine. |

## Logging

These variables can be changed at runtime without restarting the container.

| Variable    | Default Value | Accepted Values                  | Description                                 |
|-------------|---------------|----------------------------------|---------------------------------------------|
| `LEVEL`     | `debug`       | `debug`, `info`, `warn`, `error` | The logging level.                          |
| `LOG_LEVEL` | `true`        | boolean                          | Whether to log the level.                   |
| `VERBOSE`   | `3`           | number                           | The verbosity level.                        |
| `FORMAT`    | `raw`         | `raw`, `json`                    | The logging format.                         |
| `STYLE`     | `true`        | boolean                          | Whether to use styled output.               |
| `TIMESTAMP` | `true`        | boolean                          | Whether to include a timestamp in the logs. |
| `CONTEXT`   | `true`        | boolean                          | Whether to include the context in the logs. |
