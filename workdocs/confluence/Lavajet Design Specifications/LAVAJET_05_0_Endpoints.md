# Endpoints

The API of record is the generated OpenAPI document, not a user guide:

* [`lavajet-api.json`](../../lavajet-api.json) — EW (MAH) build, 215 paths.
* [`lavajet-pla-api.json`](../../lavajet-pla-api.json) — PLA (Admin) build, 254 paths.

Both are exported with the package scripts:

```
npm run extract:api        # npx decaf nest export-api --input ./lib/app.module.js ...
npm run extract:api:pla     # npx decaf nest export-api --input ./lib/app.module.js ...
```

The export command boots the compiled application module so the Swagger
document is derived from the live controller metadata. It therefore requires a
reachable persistence layer. If the boot cannot complete, the checked-in JSON must
be updated by hand and the delta recorded in the pull request (see
[Refresh procedure](#refresh-procedure)).

## Route families

### Auto-generated model routes

With `autoControllers: true`, every registered model produces a standard route
family. For a model whose table name is `x` (kebab-cased), the generated routes
are:

| Method   | Path                           | Operation                 |
|----------|--------------------------------|---------------------------|
| `POST`   | `/x`                           | Create one record.        |
| `POST`   | `/x/bulk`                      | Create many records.      |
| `GET`    | `/x/bulk`                      | Read many by key list.    |
| `PUT`    | `/x/bulk`                      | Update many.              |
| `DELETE` | `/x/bulk`                      | Delete many.              |
| `GET`    | `/x/{pk}`                      | Read one by primary key.  |
| `PUT`    | `/x/{pk}`                      | Update one.               |
| `DELETE` | `/x/{pk}`                      | Delete one.               |
| `GET`    | `/x/find/{value}`              | Prepared find by value.   |
| `GET`    | `/x/findBy/{key}/{value}`      | Find by attribute.        |
| `GET`    | `/x/findOneBy/{key}`           | Find one by attribute.    |
| `GET`    | `/x/listBy/{key}`              | List by attribute.        |
| `GET`    | `/x/page/{value}`              | Page by value.            |
| `GET`    | `/x/paginateBy/{key}/{page}`   | Paginate by attribute.    |
| `GET`    | `/x/statement/{method}/{args}` | Run a prepared statement. |

Composite-key models use the composed key in the path, for example
`/batch/{productCode}/{batchNumber}`, `/leaflet/{productCode}/{batchNumberOrLeafletType}/{langOrLeafletType}`
and `/history/{table}/{key}/{version}`. Models with blocked operations still
advertise the route but reject the call, which is why the OpenAPI document lists
`delete` for `leaflet` even though deletion is blocked in
`src/app.module.ts:95`.

### EW (MAH) — explicit controllers

| Method                                                 | Path                                                                                          | Controller                          | Notes                                                  |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------|-------------------------------------|--------------------------------------------------------|
| `GET`                                                  | `/health`                                                                                     | `AppController`                     | Liveness.                                              |
| `GET`                                                  | `/no-content`                                                                                 | `AppController`                     | Returns `204`.                                         |
| `GET`                                                  | `/auth/login`                                                                                 | `AuthController`                    | Keycloak login handshake.                              |
| `GET`                                                  | `/account/info`                                                                               | `AccountController`                 | `AccountInfo` for the caller.                          |
| `POST`                                                 | `/infrastructure/join-channel`                                                                | `InfrastructureController`          | Token-protected, public.                               |
| `POST`                                                 | `/infrastructure/deploy-contract`                                                             | `InfrastructureController`          | Token-protected, public.                               |
| `POST`                                                 | `/leaflet-resolver/update/unresolved`                                                         | `LeafletResolverController`         | Queue resolver tasks.                                  |
| `POST`                                                 | `/leaflet-resolver/update/unresolved-without-leaflets`                                        | `LeafletResolverController`         | Queue resolver tasks.                                  |
| `POST`                                                 | `/leaflet-resolver/update/{gtin}`                                                             | `LeafletResolverController`         | Resolve one GTIN.                                      |
| `GET`                                                  | `/public/owner/{productCode}`                                                                 | `OwnerController`                   | Public owner lookup.                                   |
| `GET`                                                  | `/public/metadata/{productCode}`                                                              | `MetadataController`                | Public metadata.                                       |
| `GET`                                                  | `/public/metadata/{productCode}/{batchNumber}`                                                | `MetadataController`                | Public batch metadata.                                 |
| `GET`                                                  | `/public/leaflet`                                                                             | `LeafletController`                 | Public leaflet read.                                   |
| `GET`                                                  | `/public/leaflet/external/{gtin}/{batch}/{epiType}/{market}/{lang}/{fileName}`                | `LeafletController`                 | Stream an external document.                           |
| `GET`                                                  | `/public/leaflet/external/{gtin}/{epiType}/{market}/{lang}/{fileName}`                        | `LeafletController`                 | Batch-less fallback.                                   |
| `POST`                                                 | `/public/leaflet/external/{gtin}/{batch}/{epiType}/{market}/{lang}`                           | `LeafletController`                 | Upload an external document (authenticated).           |
| `POST`                                                 | `/public/leaflet/external/{gtin}/{epiType}/{market}/{lang}`                                   | `LeafletController`                 | Batch-less upload (authenticated).                     |
| `GET`                                                  | `/public/leaflet-resolver/listBy/{key}`                                                       | `PublicLeafletResolverController`   | Public resolver listing.                               |
| `GET`                                                  | `/kibana/auth`                                                                                | `KibanaController`                  | Kibana session establishment.                          |
| `GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, SEARCH` | `/kibana/{path}`                                                                              | `KibanaController`                  | Full proxy, version-neutral.                           |
| `GET`                                                  | `/events`                                                                                     | observer stream                     | SSE stream.                                            |
| `GET`                                                  | `/events/{model}`                                                                             | observer stream                     | SSE stream for one model.                              |
| `GET, POST, PUT, DELETE`                               | `/integration/audit/{logType}`                                                                | `IntegrationAuditController`        | Legacy.                                                |
| `GET, PUT, POST, DELETE`                               | `/integration/batch/{productCode}/{batchNumber}`                                              | `IntegrationBatchController`        | Legacy.                                                |
| `GET, POST, PUT, DELETE`                               | `/integration/epi/{productCode}/{batchNumberOrLang}/{langOrLeafletType}/{epiTypeorEpiMarket}` | `IntegrationEpiController`          | Legacy.                                                |
| `GET, POST, PUT, DELETE`                               | `/integration/epi/{productCode}/{language}/{epiType}`                                         | `IntegrationEpiController`          | Legacy.                                                |
| `GET, POST, PUT`                                       | `/integration/image/{productCode}`                                                            | `IntegrationImageController`        | Legacy.                                                |
| `GET, POST, PUT`                                       | `/integration/product/{productCode}`                                                          | `IntegrationProductController`      | Legacy.                                                |
| `GET`                                                  | `/integration/listProductLangs/{gtin}/{epiType}`                                              | `IntegrationLegacyRoutesController` | Legacy.                                                |
| `GET`                                                  | `/integration/listBatchLangs/{gtin}/{batchNumber}/{epiType}`                                  | `IntegrationLegacyRoutesController` | Legacy.                                                |
| `GET`                                                  | `/integration/listProducts`                                                                   | `IntegrationLegacyRoutesController` | Legacy, query params `start`/`number`/`sort`/`filter`. |
| `GET`                                                  | `/integration/listBatches`                                                                    | `IntegrationLegacyRoutesController` | Legacy, query params.                                  |

### PLA (Admin) — explicit controllers

The PLA build keeps `/health`, `/no-content`, `/auth/login`, `/account/info`,
the `/kibana/*` proxy, the `/events` stream and the public owner/leaflet-resolver
routes, and replaces the MAH infrastructure and integration surfaces with:

| Method | Path                                                               | Controller                    |
|--------|--------------------------------------------------------------------|-------------------------------|
| `POST` | `/infrastructure/update-contract-images`                           | `InfrastructurePLAController` |
| `POST` | `/infrastructure/update-contracts`                                 | `InfrastructurePLAController` |
| `POST` | `/infrastructure/deploy/{orgName}`                                 | `InfrastructurePLAController` |
| `POST` | `/infrastructure/onboard-on-prem`                                  | `InfrastructurePLAController` |
| `POST` | `/infrastructure/claim-on-prem`                                    | `InfrastructurePLAController` |
| `POST` | `/infrastructure/deploy-on-prem-contracts`                         | `InfrastructurePLAController` |
| `GET`  | `/infrastructure/download/certificates/{mspId}/{token}`            | `InfrastructurePLAController` |
| `GET`  | `/infrastructure/download/contract/{contractName}/{mspId}/{token}` | `InfrastructurePLAController` |
| `GET`  | `/infrastructure/download/{mspId}/{token}`                         | `InfrastructurePLAController` |
| `POST` | `/infrastructure/generate-certificates`                            | `InfrastructurePLAController` |
| `GET`  | `/public/validate/token/{token}`                                   | `ValidateController`          |

The PLA build does **not** register the `/integration` controllers.