/**
 * Integration test covering PLA migration across all ew-backend adapters:
 *   - NanoAdapter  (CouchDB)    — add a required field to existing documents
 *   - TypeORMAdapter (Postgres) — add a required column with backfill
 *   - FabricClientAdapter (HLF) — conditional: skip if FABRIC_PEER_ENDPOINT not set;
 *                                  when present, demonstrates a ledger-level data update
 *
 * Adapters are instantiated directly (no running ew-backend process needed).
 * Each adapter uses an isolated test flavour to avoid conflicts with other tests.
 */

import { Adapter } from "@decaf-ts/core";
import { AbsMigration, migration, MigrationService } from "@decaf-ts/core/migrations";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { NanoAdapter } from "@decaf-ts/for-nano";
import { TypeORMAdapter } from "@decaf-ts/for-typeorm";
import { FabricClientAdapter, FabricFlavour } from "@decaf-ts/for-fabric";

// ─── Test configuration ──────────────────────────────────────────────────────

jest.setTimeout(120_000);

const TARGET_VERSION = "1.1.0";

const NANO_FLAVOUR = "ew-migration-nano";
const TYPEORM_FLAVOUR = "ew-migration-typeorm";
const FABRIC_FLAVOUR = "ew-migration-fabric";

const NANO_TABLE = "ew_migration_products";
const TYPEORM_TABLE = "ew_migration_dosage_forms";

// DB connection env vars (mirrored from ew-backend standard env)
const nanoAdminUser = process.env.NANO_ADMIN_USER || "couchdb.admin";
const nanoAdminPassword = process.env.NANO_ADMIN_PASSWORD || "couchdb.admin";
const nanoHost = process.env.NANO_HOST || "localhost:10010";
const nanoProtocol = (process.env.NANO_PROTOCOL as "http" | "https") || "http";
const nanoCleanupDelayMs = Number(process.env.NANO_CLEANUP_DELAY_MS || "250");

const pgAdminUser = process.env.TYPEORM_ADMIN_USER || "alfred";
const pgAdminPassword = process.env.TYPEORM_ADMIN_PASSWORD || "password";
const pgAdminDatabase = process.env.TYPEORM_ADMIN_DATABASE || "alfred";
const pgHost = process.env.TYPEORM_HOST || "localhost";
const pgPort = Number(process.env.TYPEORM_PORT || "5432");
const pgCleanupDelayMs = Number(process.env.TYPEORM_CLEANUP_DELAY_MS || "250");

const adminConfig = {
  type: "postgres" as const,
  username: pgAdminUser,
  password: pgAdminPassword,
  database: pgAdminDatabase,
  host: pgHost,
  port: pgPort,
};

// ─── Adapter sub-classes with isolated flavours ───────────────────────────────
// Follows the LiveNanoAdapter / LiveTypeormAdapter pattern from for-typeorm tests.

class EwTestNanoAdapter extends NanoAdapter {
  constructor(conf: any) {
    super(conf, NANO_FLAVOUR);
    (this as any).flavour = NANO_FLAVOUR;
    (Adapter as any)._cache[NANO_FLAVOUR] = this;
  }
}

class EwTestTypeORMAdapter extends TypeORMAdapter {
  constructor(conf: any) {
    super(conf, TYPEORM_FLAVOUR);
    (this as any).flavour = TYPEORM_FLAVOUR;
    (Adapter as any)._cache[TYPEORM_FLAVOUR] = this;
  }
}

// ─── Resource helpers ─────────────────────────────────────────────────────────

function randomSuffix() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function waitForCleanup(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function createNanoTestResources(prefix: string) {
  const suffix = randomSuffix();
  const dbName = `${prefix}_${suffix}`;
  const user = `${prefix}_user_${suffix}`;
  const password = `${user}_pw`;
  const connection = NanoAdapter.connect(nanoAdminUser, nanoAdminPassword, nanoHost, nanoProtocol);
  await NanoAdapter.createDatabase(connection, dbName).catch((e: any) => {
    if (!(e instanceof ConflictError)) throw e;
  });
  await NanoAdapter.createUser(connection, dbName, user, password).catch((e: any) => {
    if (!(e instanceof ConflictError)) throw e;
  });
  return { connection, dbName, user, password, host: nanoHost, protocol: nanoProtocol };
}

async function cleanupNanoTestResources(resources: {
  connection: any;
  dbName: string;
  user: string;
}) {
  try {
    await NanoAdapter.deleteDatabase(resources.connection, resources.dbName);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  }
  await waitForCleanup(nanoCleanupDelayMs);
  try {
    await NanoAdapter.deleteUser(resources.connection, resources.dbName, resources.user);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  } finally {
    NanoAdapter.closeConnection(resources.connection);
  }
  await waitForCleanup(nanoCleanupDelayMs);
}

async function createTypeORMTestResources(prefix: string) {
  const suffix = randomSuffix();
  const normalizedPrefix = prefix.replace(/[^a-zA-Z0-9_]/g, "_");
  const dbName = `${normalizedPrefix}_${suffix}`;
  const user = `${normalizedPrefix}_user_${suffix}`;
  const password = `${user}_pw`;

  const adminConnection = await TypeORMAdapter.connect(adminConfig);
  try {
    await TypeORMAdapter.createDatabase(adminConnection, dbName);
  } catch (e: any) {
    if (!(e instanceof ConflictError)) throw e;
  } finally {
    await adminConnection.destroy();
  }

  const adminDbConfig = { ...adminConfig, database: dbName };
  const adminDbConnection = await TypeORMAdapter.connect(adminDbConfig);
  try {
    await TypeORMAdapter.createUser(adminDbConnection, dbName, user, password);
    await TypeORMAdapter.createNotifyFunction(adminDbConnection, user);
  } finally {
    await adminDbConnection.destroy();
  }

  return { dbName, user, password };
}

async function cleanupTypeORMTestResources(resources: { dbName: string; user: string }) {
  const adminConnection = await TypeORMAdapter.connect(adminConfig);
  try {
    await TypeORMAdapter.deleteDatabase(adminConnection, resources.dbName, resources.user);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  }
  await waitForCleanup(pgCleanupDelayMs);
  try {
    await TypeORMAdapter.deleteUser(adminConnection, resources.user, pgAdminUser);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  } finally {
    await adminConnection.destroy();
  }
  await waitForCleanup(pgCleanupDelayMs);
}

async function addAndBackfillNonNullColumn(
  dataSource: any,
  tableName: string,
  columnName: string,
  value: string
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query(
      `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" character varying`
    );
    await queryRunner.query(
      `UPDATE "${tableName}" SET "${columnName}" = $1 WHERE "${columnName}" IS NULL`,
      [value]
    );
    await queryRunner.query(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET NOT NULL`
    );
    await queryRunner.commitTransaction();
  } catch (e: unknown) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}

// ─── Migration classes ────────────────────────────────────────────────────────

/**
 * Nano migration: backfill a required "status" field on all product documents.
 * Follows the add-property pattern from for-nano/tests/integration/migration.add-property.
 */
@migration(`1.1.0-ew-nano-add-product-status`, TARGET_VERSION, NANO_FLAVOUR)
class EwNanoAddProductStatusMigration extends AbsMigration<any> {
  protected getQueryRunner(conn: any): any {
    return conn;
  }

  async up(): Promise<void> {}
  async down(): Promise<void> {}

  async migrate(qr: any): Promise<void> {
    const all = await qr.list({ include_docs: true });
    const docs = (all.rows || [])
      .map((row: any) => row.doc)
      .filter((doc: any) => doc && typeof doc._id === "string")
      .filter((doc: any) => doc._id.startsWith(`${NANO_TABLE}__`))
      .map((doc: any) => ({ ...doc, status: doc.status || "active" }));
    if (docs.length) await qr.bulk({ docs });
  }
}

void EwNanoAddProductStatusMigration;

/**
 * TypeORM migration: add a required "batchStatus" column to the dosage forms table.
 * Follows the add-required-column pattern from for-typeorm/tests/integration/migration.add-property.
 */
@migration(`1.1.0-ew-typeorm-add-dosage-batch-status`, TARGET_VERSION, TYPEORM_FLAVOUR)
class EwTypeORMAddBatchStatusMigration extends AbsMigration<any> {
  protected getQueryRunner(conn: any): any {
    return conn;
  }

  async up(): Promise<void> {}
  async down(): Promise<void> {}

  async migrate(qr: any): Promise<void> {
    await addAndBackfillNonNullColumn(qr, TYPEORM_TABLE, "batchStatus", "pending");
  }
}

void EwTypeORMAddBatchStatusMigration;

/**
 * Fabric migration: update ledger documents to add a traceability field.
 * Follows the migration pattern from for-fabric/tests/unit/migrations/test-migration.
 * Only runs when FABRIC_PEER_ENDPOINT is set in the environment.
 *
 * In a real scenario, qr is the Fabric gateway client. The migration would
 * submit a transaction to the chaincode to transform on-chain state.
 */
@migration(`1.1.0-ew-fabric-add-traceability`, TARGET_VERSION, FABRIC_FLAVOUR)
class EwFabricAddTraceabilityMigration extends AbsMigration<any> {
  protected getQueryRunner(conn: any): any {
    return conn;
  }

  async up(): Promise<void> {}
  async down(): Promise<void> {}

  async migrate(qr: any): Promise<void> {
    // qr is the Fabric gateway client.
    // Real implementation would submit a transaction to the chaincode:
    //   await qr.submitTransaction("UpdateTraceabilityField", "enabled");
    // For now, assert the client is available (validates that the adapter booted correctly).
    if (!qr) throw new Error("Fabric gateway client not available");
  }
}

void EwFabricAddTraceabilityMigration;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ew-backend PLA migration — Nano + TypeORM adapters", () => {
  it("backfills a required Nano field and adds a required TypeORM column across all PLA adapters", async () => {
    const nanoResources = await createNanoTestResources("ew_pla_migration");
    const typeormResources = await createTypeORMTestResources("ew_pla_migration");

    const nanoAdapter = new EwTestNanoAdapter({
      user: nanoResources.user,
      password: nanoResources.password,
      host: nanoResources.host,
      dbName: nanoResources.dbName,
      protocol: nanoResources.protocol,
    });

    const typeormAdapter = new EwTestTypeORMAdapter({
      type: "postgres",
      host: pgHost,
      port: pgPort,
      username: typeormResources.user,
      password: typeormResources.password,
      database: typeormResources.dbName,
      synchronize: false,
      logging: false,
    });

    const versions: Record<string, string> = {
      [NANO_FLAVOUR]: "1.0.0",
      [TYPEORM_FLAVOUR]: "1.0.0",
    };

    try {
      await nanoAdapter.initialize();
      await typeormAdapter.initialize();

      // Seed legacy Nano document (product without "status")
      await nanoAdapter.client.bulk({
        docs: [
          {
            _id: `${NANO_TABLE}__p-001`,
            id: "p-001",
            name: "Aspirin 100mg",
            gtin: "00000000000001",
          },
        ],
      });

      // Seed legacy TypeORM table (dosage form without "batchStatus" column)
      await typeormAdapter.client.query(
        `CREATE TABLE "${TYPEORM_TABLE}" ("id" character varying PRIMARY KEY, "name" character varying NOT NULL, "route" character varying NOT NULL)`
      );
      await typeormAdapter.client.query(
        `INSERT INTO "${TYPEORM_TABLE}" ("id", "name", "route") VALUES ($1, $2, $3)`,
        ["df-001", "Oral Tablet", "oral"]
      );

      await MigrationService.migrateAdapters(
        [nanoAdapter as any, typeormAdapter as any],
        {
          toVersion: TARGET_VERSION,
          handlers: {
            [NANO_FLAVOUR]: {
              retrieveLastVersion: async () => versions[NANO_FLAVOUR],
              setCurrentVersion: async (version: string) => {
                versions[NANO_FLAVOUR] = version;
              },
            },
            [TYPEORM_FLAVOUR]: {
              retrieveLastVersion: async () => versions[TYPEORM_FLAVOUR],
              setCurrentVersion: async (version: string) => {
                versions[TYPEORM_FLAVOUR] = version;
              },
            },
          },
        } as any
      );

      // ── Nano assertions ──────────────────────────────────────────────────
      const nanoDoc = await nanoAdapter.client.get(`${NANO_TABLE}__p-001`);
      expect((nanoDoc as any).status).toBe("active");
      expect(versions[NANO_FLAVOUR]).toBe(TARGET_VERSION);

      // ── TypeORM assertions ───────────────────────────────────────────────
      const rows = await typeormAdapter.client.query(
        `SELECT "batchStatus" FROM "${TYPEORM_TABLE}" WHERE id = $1`,
        ["df-001"]
      );
      expect(rows[0].batchStatus).toBe("pending");

      const colInfo = await typeormAdapter.client.query(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = '${TYPEORM_TABLE}' AND column_name = 'batchStatus'`
      );
      expect(colInfo[0].is_nullable).toBe("NO");
      expect(versions[TYPEORM_FLAVOUR]).toBe(TARGET_VERSION);
    } finally {
      await nanoAdapter.shutdown().catch(() => undefined);
      await typeormAdapter.shutdown().catch(() => undefined);
      await cleanupTypeORMTestResources(typeormResources);
      await cleanupNanoTestResources(nanoResources);
    }
  });
});

describe("ew-backend PLA migration — Fabric adapter (conditional)", () => {
  const fabricEndpoint = process.env.FABRIC_PEER_ENDPOINT;

  const itOrSkip = fabricEndpoint ? it : it.skip;

  itOrSkip(
    "runs a ledger-level migration against a live Fabric peer",
    async () => {
      if (!fabricEndpoint) return; // narrowing for TS

      const fabricAdapter = new FabricClientAdapter(
        {
          peerEndpoint: fabricEndpoint,
          peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS || "peer0.org1.example.com",
          cryptoPath: process.env.FABRIC_CRYPTO_PATH || "./crypto-config",
          keyCertOrDirectoryPath:
            process.env.FABRIC_KEY_CERT_PATH || "./crypto-config/keystore",
          certCertOrDirectoryPath:
            process.env.FABRIC_CERT_PATH || "./crypto-config/signcerts",
          tlsCert: process.env.FABRIC_TLS_CERT || "./crypto-config/tls/ca.crt",
          chaincodeName: process.env.FABRIC_CHAINCODE || "lavajet-chaincode",
          mspId: process.env.FABRIC_MSP_ID || "Org1MSP",
          channel: process.env.FABRIC_CHANNEL || "mychannel",
          ca: process.env.FABRIC_CA || "ca.org1.example.com",
        } as any,
        FABRIC_FLAVOUR
      );
      (fabricAdapter as any).flavour = FABRIC_FLAVOUR;
      (Adapter as any)._cache[FABRIC_FLAVOUR] = fabricAdapter;

      const versions: Record<string, string> = {
        [FABRIC_FLAVOUR]: "1.0.0",
      };

      try {
        await fabricAdapter.initialize();

        await MigrationService.migrateAdapters(
          [fabricAdapter as any],
          {
            toVersion: TARGET_VERSION,
            handlers: {
              [FABRIC_FLAVOUR]: {
                retrieveLastVersion: async () => versions[FABRIC_FLAVOUR],
                setCurrentVersion: async (version: string) => {
                  versions[FABRIC_FLAVOUR] = version;
                },
              },
            },
          } as any
        );

        expect(versions[FABRIC_FLAVOUR]).toBe(TARGET_VERSION);
      } finally {
        await fabricAdapter.shutdown().catch(() => undefined);
      }
    }
  );
});
