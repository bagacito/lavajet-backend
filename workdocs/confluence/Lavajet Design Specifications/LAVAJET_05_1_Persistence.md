# Persistence

Persistence is provided by the decaf adapter layer. The application module declares
one adapter per flavour and one default flavour; every model is bound to a flavour with
`@uses(...)`.

## Adapter matrix

| Adapter                         | Flavour alias              | EW  | PLA | Backing store              | Transformer          |
|---------------------------------|----------------------------|-----|-----|----------------------------|----------------------|
| `FabricClientAdapter`           | `FabricFlavour` (default)  | yes | yes | Hyperledger Fabric channel | `FabricTransformer`  |
| `TypeORMAdapter`                | `TypeORMFlavour` (default) | no  | yes | PostgreSQL                 | `TypeORMTransformer` |
| `NanoAdapter`                   | `NanoFlavour` (default)    | yes | yes | CouchDB `lavajet-credentials`  | `NanoTransformer`    |
| `NanoAdapter` (alias `"tasks"`) | `"tasks"`                  | yes | yes | CouchDB `tasks`            | `NanoTransformer`    |

* EW registers Fabric + the two Nano adapters (`src/app.module.ts:132-241`).
* PLA registers Fabric + TypeORM + the two Nano adapters
  (`src/app-pla.module.ts:137-255`). TypeORM is the default flavour in PLA, so
  admin models persist to Postgres while the ledger models keep their explicit
  `FabricFlavour`.
* `FabricIdentity` is moved to Nano in both builds with
  `uses(NanoFlavour)(FabricIdentity)` (`src/app.module.ts:61`,
  `src/app-pla.module.ts:41`).

## Fabric connection

The Fabric adapter is configured from `Environment.fabric`:

| Setting                                                                      | Source                                                                                    |
|------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `cryptoPath`, `keyCertOrDirectoryPath`, `certCertOrDirectoryPath`, `tlsCert` | `fabric.*`                                                                                |
| `peerEndpoint`, `peerHostAlias`, `chaincodeName`, `ca`, `mspId`, `channel`   | `fabric.*`                                                                                |
| `allowGatewayOverride`                                                       | `fabric.preferLegacy` (EW) / `true` (PLA)                                                 |
| `legacyMspCount`                                                             | hard-coded `2`                                                                            |
| `mspMap`                                                                     | `FABRIC__MSP_MAP__…` / `FABRIC__MSP_MAP__BAGACITOMSP__…` with localhost defaults |

The MSP map is the one place the backend reads `process.env` directly, because an
indexed map cannot be expressed as a decaf path. The default peers are
`localhost:7050`, `:7051`, `:7052` with aliases
`bagacito-peer-0/1/2` and the PLA TLS certs under
`./docker/docker-data/`.

## CouchDB / Nano

The credential store and the task engine use separate CouchDB databases:

| Purpose | Flavour | Database env | Default |
|---------|---------|--------------|---------|
| Credential store | `NanoFlavour` (default) | `DATABASE__COUCHDB__DATABASE` | `lavajet-credentials` |
| Task engine | `"tasks"` | `TASKS__DATABASE` | `tasks` |

Both share host, port and protocol from `database.couchdb.*`
(`DATABASE__COUCHDB__HOST/PORT/PROTOCOL`) and use the task credentials
`TASKS__USER` / `TASKS__PASSWORD` for the task database.

## PostgreSQL / TypeORM (PLA only)

The PLA build configures TypeORM with `type: "postgres"` and the values from
`AdminEnvironment.database.postgres`:

| Option        | Env var                                                                                      |
|---------------|----------------------------------------------------------------------------------------------|
| `host`        | `DATABASE__POSTGRES__HOST`                                                                   |
| `port`        | `DATABASE__POSTGRES__PORT`                                                                   |
| `database`    | `DATABASE__POSTGRES__DATABASE`                                                               |
| `username`    | `DATABASE__POSTGRES__USER`                                                                   |
| `password`    | `DATABASE__POSTGRES__PASSWORD`                                                               |
| `synchronize` | `DATABASE__POSTGRES__SYNCHRONIZE` (defaults `true`; must be `false` in managed environments) |
| `logging`     | hard-coded `true`                                                                            |

Schema changes belong to migrations, never to `synchronize` in a managed
deployment. The default is `true` only so that a fresh/empty database can be
bootstrapped; the value is read through `(adminEnv.database.postgres as any)?.synchronize ?? true`
so the code stays forward-compatible with toolkit versions that predate the field
(`src/app-pla.module.ts:206-207`).

## Operation blocks

Blocks are applied by `@BlockOperations` immediately after the model imports and
before the Nest wiring, so the policy is visible in one place. See
[Models and Entities](LAVAJET_04_Models.md) for the per-model lists.

## Handlers and transformers

The request/response translation for each flavour is provided by:

* `FabricTransformer` (`src/handlers/HLFabricRequestTransformer.ts`)
* `NanoTransformer` (`src/handlers/NanoTransformer.ts`)
* `TypeORMTransformer` (`src/handlers/TypeORMTransformer.ts`)

`ImpersonateHandler` is registered as a shared decaf handler in both builds
(`src/app.module.ts:121`, `src/app-pla.module.ts:107`) and allows a privileged
caller to act on behalf of another identity for support operations.

## Boot

Persistence is initialised during `DecafModule.forRootAsync.initialization` via
`Service.boot()` (`src/app.module.ts:234-240`,
`src/app-pla.module.ts:248-254`). A boot failure is wrapped in an
`InternalError`, so a misconfigured adapter fails fast at start-up rather than on the
first request.

## Observer / task persistence

The observer stream persists events through the `FabricFlavour` and `"tasks"`
flavours and serves them over SSE at `EVENTS_API_PATH` (`/events`). See
[Architecture](LAVAJET_03_Architecture.md).

## Migrations

Migrations run through the decaf CLI exposed by `src/bin/cli.ts`:

```
node lib/bin/cli.js nest migrate --input ./lib/app.module.js --to <version> [--flavour ...] [--task-mode] [--dry-run] [--version-dir <dir>] [--reference <name>]
```

* Versioning is `SemverMigrationVersioning`.
* `--version-dir` persists the last-migrated version per adapter to
  `<versionDir>/<alias>.migration.version`; without it every run re-applies all
  migrations up to the target.
* The boot command seeds the migration lock file from `MIGRATIONS__LOCK_FILE`
  (default `./locks/version.lock`) with the package version when it is missing or
  not a semver (`src/cli-module.ts:27-47`).
* The task adapter is excluded from migration targets when `--task-mode` is used,
  because `MigrationService` rejects the task service and its adapter appearing
  together.
* Package-level defaults can be declared under `decaf.migration` in
  `package.json` (`input`, `toVersion`, `flavour(s)`, `versionDir`, `references`,
  `taskMode`, `dryRun`).
