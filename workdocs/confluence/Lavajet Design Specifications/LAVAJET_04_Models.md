# Models and Entities

The domain models are defined in `@bagacito/lavajet-toolkit` and persisted by
the decaf persistence layer. This section lists the models registered by
`ew-backend`, their table names, flavours and the operations the application
blocks. The generated OpenAPI schemas currently carry no field definitions, so the
field lists below are taken from the toolkit model decorators.

## Flavour and table conventions

* **Fabric models** extend the toolkit `HLFBaseModel` / `HLFIdentifiedModel`
  (`shared/models/fabric/*`). They are the ledger-backed records.
* **Admin models** extend the toolkit `TypeORMBaseModel` /
  `TypeORMIdentifiedModel` (`shared/models/admin/*`). They are Postgres-backed.
* `@uses(NanoFlavour)(FabricIdentity)` (`src/app.module.ts:61`,
  `src/app-pla.module.ts:41`) moves the identity model to CouchDB in both builds.
* The auto-controller derives the route from the model's table name, so the table
  name and the route prefix are the same value.

## EW (MAH) models — `src/app.module.ts`

| Model              | Route / table      | Key                                                                    | Notes                                                  |
|--------------------|--------------------|------------------------------------------------------------------------|--------------------------------------------------------|
| `Product`          | `product`          | `productCode`                                                          | Ledger-backed. No delete.                              |
| `Batch`            | `batch`            | composite `productCode`/`batchNumber`                                  | Ledger-backed. No delete.                              |
| `Leaflet`          | `leaflet`          | composite `productCode`/`batchNumber`/`leafletType`/`lang`/`epiMarket` | Ledger-backed. No delete. Owns `externalFiles`.        |
| `LeafletFile`      | `leaflet-file`     | `leafletId`/`fileName`                                                 | Ledger-backed. No delete.                              |
| `LeafletResolver`  | `leaflet-resolver` | `id`                                                                   | Ledger-backed. No create/update/delete via API.        |
| `ProductMarket`    | `market`           | `productCode`/`marketId`                                               | Ledger-backed. No delete.                              |
| `ProductStrength`  | `product-strength` | `productCode`/`uuid`                                                   | Ledger-backed. No delete.                              |
| `ProductImage`     | `product-image`    | `productCode`                                                          | Ledger-backed. No delete.                              |
| `GtinOwner`        | `gtin-owner`       | `productCode`                                                          | Ledger-backed.                                         |
| `Entity`           | `entity`           | `id`                                                                   | Ledger-backed. No create/update/delete via API.        |
| `AccountConfig`    | `account-config`   | `account`                                                              | Ledger-backed. No create/update/delete via API.        |
| `LavajetModule`        | `lavajet-module`       | `id`                                                                   | Ledger-backed. No create/update/delete via API.        |
| `LavajetModuleFeature` | `module-features`  | `module`/`name`                                                        | Ledger-backed. No create/update/delete via API.        |
| `History`          | `history`          | composite `table`/`key`/`version`                                      | Ledger-backed. Read-only.                              |
| `Audit`            | `audit`            | `id`                                                                   | Ledger-backed. Read-only.                              |
| `FabricIdentity`   | `identities`       | `id`                                                                   | Nano (CouchDB). No create/update/delete via API.       |
| `TaskModel`        | `tasks`            | `id`                                                                   | Task engine, Nano `"tasks"` flavour. No create/update. |
| `TaskEventModel`   | `task-event`       | composite `taskId`/`classification`/`uuid`                             | Task engine. No create/update/delete.                  |

### Key fields

* **Product** — `productCode` (pk), `inventedName`, `nameMedicinalProduct`,
  `internalMaterialCode`, `productRecall`, `imageData`, `strengths`, `markets`,
  `owner`, `resolvedBy`, plus audit fields.
* **Batch** — composite key `productCode` + `batchNumber`, `expiryDate`,
  `importLicenseNumber`, `dateOfManufacturing`, `manufacturerName`,
  `manufacturerAddress`, `packagingSiteName`, `batchRecall`, `owner`.
* **Leaflet** — `productCode`, `batchNumber`, `leafletType`, `lang`,
  `epiMarket`, `xmlFileContent`, `otherFilesContent`, `externalFiles`, `owner`.
  `externalFiles` is a list of `ExternalFile` entries
  (`fileName`, `contentType`, `size`, `storageKey`, `uploadedAt`) whose bytes live
  in S3 and whose reference is persisted on the leaflet.
* **LeafletResolver** — `id`, `urlStrings`, `version`.
* **ProductMarket** — `productCode`, `marketId`, `nationalCode`, `mahName`,
  `legalEntityName`, `mahAddress`, `owner`.
* **ProductStrength** — `productCode`, `uuid`, `strength`, `substance`, `owner`.
* **ProductImage** — `productCode`, `content`.
* **GtinOwner** — `productCode`, `productName`, `ownedBy`, `endpoint`.
* **Entity** — `id`, `endpoint`.
* **History** — `table`, `key`, `version`, `record`.
* **Audit** — `model`, `action`, `recordId`, `userId`, `userGroup`,
  `transaction`, `diffs`, `owner`.
* **AccountConfig** — `account`, `modules`, `features`, `dashboards`,
  `legalName`, `orgName`, `mspId`, `classification`, `onPrem`, `deployed`,
  `active`, `endpoint`, `backendEndpoint`, `owner`.

## PLA (Admin) models — `src/app-pla.module.ts`

The PLA build registers the same ledger model set as the EW build (the toolkit models
are discovered by the same import side effects), but blocks **create, update and delete**
on the ledger models it does not want the admin API to write:
`Product`, `Batch`, `ProductMarket`, `ProductStrength`, `ProductImage`,
`LeafletFile`, `Leaflet` (`src/app-pla.module.ts:48-87`). The PLA ledger surface is
therefore read-only, whereas the EW ledger surface is delete-blocked but writable.
`TaskModel`/`TaskEventModel`/`FabricIdentity`/`History` carry the same blocks as in
the EW build.

The PLA build adds the Postgres-backed admin models:

| Model                 | Route / table     | Key fields                                                                                                                                                                                            |
|-----------------------|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `Account`             | `account`         | `id`, `legalName`, `orgName`, `mspId`, `portBase`, `classification`, `token`, `onPrem`, `deployed`, `active`, `inProgress`, `endpoint`, `backendEndpoint`, `keycloakSetupConfig`, `kibanaSetupConfig` |
| `AccountConfig`       | `account-config`  | Same as EW plus `dashboards`, `modules`, `features`.                                                                                                                                                  |
| `Token`               | `token`           | `id`, `mspid`, `operation`, `classification`, `expiredAt`, `active`, `claimed`                                                                                                                        |
| `Counter`             | `counter`         | Sequence/counter model from the toolkit.                                                                                                                                                              |
| `KeycloakSetupConfig` | `keycloak-config` | `host`, `protocol`, `rootApiUser`, `adminApiUser`, `realmApiUser`, `client`, `identityProvider`                                                                                                       |
| `KibanaSetupConfig`   | `kibana-config`   | `host`, `es_host`, `protocol`, `realm`, `adminApiUser`, `realmApiUser`, `dashboards`                                                                                                                  |

The PLA-specific configuration sub-models are persisted inside the admin models:

* `KeycloakClientConfig` — `clientId`, `clientUUID`, `secret`, `clientName`,
  `description`, `rootUrl`, `adminUrl`, `baseUrl`, `redirectUris`, `webOrigins`,
  `serviceAccountsEnabled`, `authorizationServicesEnabled`, `roles`.
* `KeycloakClientRoleConfig` — `roleName`, `claimValue`, `description`.
* `KeycloakIdentityProviderConfig` — `alias`, `displayName`, `tenantId`,
  `clientId`, `clientSecret`, `providerId`, `syncMode`, `mapperClaimName`,
  `mapperSyncMode`.
* `KeycloakUser` — `realm`, `apiClientId`, `usernameUUID`, `username`, `password`.
* `KibanaUser` — `username`, `password`.

## API-only models

These are not persisted; they shape request/response payloads:

* `AccountInfo` — `account`, `accountConfig`, `user`, `roles`
  (`shared/models/api/AccountInfo`). Returned by `GET /account/info` in both
  builds.
* `IntegrationProduct`, `IntegrationEpi`, `IntegrationBatch` and
  `IntegrationImage` — the legacy `/integration` payload wrappers
  (`src/api/integration/utils`).
* `ExternalFile` — the S3-backed external document entry used by the public
  leaflet `external` routes.

## Audit and history

`Audit` records every write with the acting user and group, the transaction id and
the diffs. `History` records the versioned table/key history. Both are generated
automatically by the decaf observer pipeline; `History` disables grouping queries
and bulk statements (`src/app.module.ts:118-119`,
`src/app-pla.module.ts:100-101`).
