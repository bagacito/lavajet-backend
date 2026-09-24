# Lavajet Backend Environment Variables

This document outlines the environment variables used by the Lavajet backend application.

## Base Configuration

These variables are inherited from the Lavajet Toolkit.

| Variable        | Default Value            | Accepted Values                   | Description                     |
|-----------------|--------------------------|-----------------------------------|---------------------------------|
| `APP`           | `LAVAJET-ew`                 | string                            | The name of the application.    |
| `ENV`           | `development`            | `development`, `production`, etc. | The application environment.    |
| `PROJECT_SHORT` | `Lavajet`                    | string                            | A short name for the project.   |
| `PROJECT_LONG`  | `Product Trust Platform` | string                            | A long name for the project.    |
| `ORG_NAME`      | `bagacito`      | string                            | The name of the organization.   |
| `ORG_DOMAIN`    | `lavajet.internal`           | string                            | The domain of the organization. |

## Lavajet Configuration

| Variable           | Default Value    | Accepted Values | Description                          |
|--------------------|------------------|-----------------|--------------------------------------|
| `LAVAJET__HOST`        | `localhost:3000` | string          | The hostname of the Lavajet application. |
| `LAVAJET__PROTOCOL`    | `http`           | `http`, `https` | The protocol of the Lavajet application. |
| `LAVAJET__BASE_PUBLIC` | `public`         | string          | The base public path.                |
| `THROTTLING__ENABLED` | `true`         | bollean          | Throttling enabled.                |
| `THROTTLING__DEFAULT_TTL_MS` | 60000       | number          | Throttling default ttl.                |
| `THROTTLING__DEFAULT_LIMIT` | 100         | number          | Throttling default limit.                |
| `THROTTLING__PUBLIC_TTL_MS` | 60000        | number          | Throttling ttl for public endpoints.                |
| `THROTTLING__PUBLIC_LIMIT` | 20         | number          | Throttling limit for public endpoints.                |


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

## Kibana Configuration

| Variable                     | Default Value                          | Accepted Values | Description                               |
|------------------------------|----------------------------------------|-----------------|-------------------------------------------|
| `KIBANA__HOST`               | `kibana.lavajet.internal`                  | string          | The hostname of Kibana.                   |
| `KIBANA__ES_HOST`            | `es.lavajet.internal`                      | string          | The hostname of Elasticsearch for Kibana. |
| `KIBANA__HOST_PROTOCOL`      | `https`                                | `http`, `https` | The protocol for the Kibana host.         |
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
| `DATABASE__COUCHDB__USER`           | `admin`           | string          | The username for CouchDB.                 |
| `DATABASE__COUCHDB__PASSWORD`       | `admin-pw`        | string          | The password for CouchDB.                 |
| `DATABASE__COUCHDB__PORT`           | `5984`            | number          | The port of CouchDB.                      |
| `DATABASE__COUCHDB__HOST`           | `localhost`       | string          | The hostname of CouchDB.                  |
| `DATABASE__COUCHDB__PROTOCOL`       | `http`            | `http`, `https` | The protocol for CouchDB.                 |
| `DATABASE__COUCHDB__DATABASE`       | `lavajet-credentials` | string          | The name of the CouchDB database.         |

## Fabric Configuration

| Variable                                             | Default Value                               | Accepted Values | Description                                   |
|------------------------------------------------------|---------------------------------------------|-----------------|-----------------------------------------------|
| `FABRIC__MSP_MAP__BAGACITOMSP__0__ENDPOINT` |                                             | string          | Endpoint to PLA peer 0.                       |
| `FABRIC__MSP_MAP__BAGACITOMSP__0__ALIAS`    |                                             | string          | alias.                                        |
| `FABRIC__MSP_MAP__BAGACITOMSP__0__TLS_CERT` |                                             | string          | path to tls cert.                             |
| `FABRIC__MSP_MAP__BAGACITOMSP__1__ENDPOINT` |                                             | string          | Endpoint to PLA peer 1.                       |
| `FABRIC__MSP_MAP__BAGACITOMSP__1__ALIAS`    |                                             | string          | alias.                                        |
| `FABRIC__MSP_MAP__BAGACITOMSP__1__TLS_CERT` |                                             | string          | path to tls cert.                             |
| `FABRIC__MSP_MAP__BAGACITOMSP__2__ENDPOINT` |                                             | string          | Endpoint to PLA peer 1.                       |
| `FABRIC__MSP_MAP__BAGACITOMSP__2__ALIAS`    |                                             | string          | alias.                                        |
| `FABRIC__MSP_MAP__BAGACITOMSP__2__TLS_CERT` |                                             | string          | path to tls cert.                             |
| `FABRIC__LEGACY_MSP_COUNT`                           | `2`                                         | number          | The number of legacy MSPs.                    |
| `FABRIC__ALLOW_GATEWAY_OVERRIDE`                     | `true`                                      | boolean         | Whether to allow gateway override.            |
| `FABRIC__CRYPTO_PATH`                                | `../docker/docker-data`                     | string          | The path to the crypto material.              |
| `FABRIC__KEY_CERT_OR_DIRECTORY_PATH`                 | `../docker/docker-data/admin/msp/keystore`  | string          | The path to the key certificate or directory. |
| `FABRIC__CERT_CERT_OR_DIRECTORY_PATH`                | `../docker/docker-data/admin/msp/signcerts` | string          | The path to the certificate or directory.     |
| `FABRIC__TLS_CERT`                                   | `../docker/docker-data/tls-ca-cert.pem`     | string          | The path to the TLS certificate.              |
| `FABRIC__TLS_VERIFY`                                 | `true`                                      | boolean         | Whether to verify the TLS certificate.        |
| `FABRIC__PEER_ENDPOINT`                              | `org-a-peer-0:7031`                         | string          | The endpoint of the peer.                     |
| `FABRIC__PEER_HOST_ALIAS`                            | `org-a-peer-0`                              | string          | The host alias of the peer.                   |
| `FABRIC__CHAINCODE_NAME`                             | `lavajet-contract`                              | string          | The name of the chaincode.                    |
| `FABRIC__CA_ENDPOINT`                                | `org-a-ca:7011`                             | string          | The endpoint of the CA.                       |
| `FABRIC__CA`                                         | `org-a`                                     | string          | The name of the CA.                           |
| `FABRIC__MSP_ID`                                     | `Peer0OrgaMSP`                              | string          | The MSP ID.                                   |
| `FABRIC__CHANNEL`                                    | `simple-channel`                            | string          | The name of the channel.                      |
| `FABRIC__SIZE_LIMIT`                                 | `15000`                                     | number          | The size limit.                               |
| `FABRIC__EVALUATE_TIMEOUT`                           | `5000`                                      | number          | The evaluate timeout in seconds.              |
| `FABRIC__ENDORSE_TIMEOUT`                            | `15000`                                     | number          | The endorse timeout in seconds.               |
| `FABRIC__SUBMIT_TIMEOUT`                             | `5000`                                      | number          | The submit timeout in seconds.                |
| `FABRIC__COMMIT_TIMEOUT`                             | `60000`                                     | number          | The commit timeout in seconds.                |

## Client Configuration

| Variable              | Default Value | Accepted Values | Description                    |
|-----------------------|---------------|-----------------|--------------------------------|
| `CLIENT__PRIVATE_KEY` |               | string          | The private key of the client. |
| `CLIENT__PUBLIC_KEY`  |               | string          | The public key of the client.  |

## CORS Configuration

| Variable        | Default Value                 | Accepted Values | Description              |
|-----------------|-------------------------------|-----------------|--------------------------|
| `CORS__ENABLED` | `true`                        | boolean         | Whether CORS is enabled. |
| `CORS__ORIGINS` | `*`                           | string          | The allowed origins.     |
| `CORS__VERBS`   | `POST,GET,PUT,DELETE,OPTIONS` | string          | The allowed HTTP verbs.  |

## JWT Configuration

| Variable          | Default Value | Accepted Values | Description              |
|-------------------|---------------|-----------------|--------------------------|
| `JWT__SECRET_KEY` |               | string          | The secret key for JWT.  |
| `JWT__EXPIRY`     | `5m`          | string          | The expiry time for JWT. |

## Swagger Configuration

| Variable                    | Default Value                                                     | Accepted Values | Description                         |
|-----------------------------|-------------------------------------------------------------------|-----------------|-------------------------------------|
| `SWAGGER__ENABLED`          | `true`                                                            | boolean         | Whether Swagger is enabled.         |
| `SWAGGER__TITLE`            | `Lavajet API`                                           | string          | The title of the Swagger UI.        |
| `SWAGGER__DESCRIPTION`      | `Secure and scalable digital connection for product information.` | string          | The description of the Swagger UI.  |
| `SWAGGER__ASSETS_PATH`      | `../workdocs/assets`                                              | string          | The path to the Swagger assets.     |
| `SWAGGER__FAVICON_PATH`     | `Icon.png`                                                        | string          | The path to the favicon.            |
| `SWAGGER__TOPBAR_ICON_PATH` | `Banner.png`                                                      | string          | The path to the topbar icon.        |
| `SWAGGER__TOPBAR_BG_COLOR`  | `#102c58`                                                         | string          | The background color of the topbar. |

## Limits Configuration

| Variable                         | Default Value | Accepted Values | Description                                |
|----------------------------------|---------------|-----------------|--------------------------------------------|
| `LIMITS__BODY_PARSER_JSON`       | `30mb`        | string          | The limit for the JSON body parser.        |
| `LIMITS__BODY_PARSER_URLENCODED` | `5mb`         | string          | The limit for the URL-encoded body parser. |

## Scans Configuration

| Variable                     | Default Value | Accepted Values | Description                                |
|------------------------------|---------------|-----------------|--------------------------------------------|
| `SCANS__ALLOW_MISSING_BATCH` | `false`       | boolean         | Whether to allow missing batches in scans. |

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
