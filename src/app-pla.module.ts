/**
 * @module ew-backend/app-pla
 * @description This is the main application module for the PLA (PharmaLedger Association) specific backend.
 * @summary It imports and configures all the necessary modules for the PLA application.
 * @category Application
 */

import {
  PreparedStatementKeys,
  Service,
  TaskEventModel,
  TaskModel,
} from "@decaf-ts/core";
import {
  BlockOperations,
  InternalError,
  OperationKeys,
} from "@decaf-ts/db-decorators";
import { uses } from "@decaf-ts/decoration";
import {
  FabricClientAdapter,
  FabricFlavour,
  PeerConfig,
} from "@decaf-ts/for-fabric";
import { NanoAdapter, NanoFlavour } from "@decaf-ts/for-nano";
import { TypeORMAdapter } from "@decaf-ts/for-typeorm";
import { controllerConfig, DecafModule } from "@decaf-ts/for-nest";
import {
  AdminEnvironment,
  Batch,
  FabricIdentity,
  History,
  Leaflet,
  LeafletFile,
  Product,
  ProductImage,
  ProductMarket,
  ProductStrength,
} from "@bagacito/lavajet-toolkit";

uses(NanoFlavour)(FabricIdentity);
BlockOperations([OperationKeys.UPDATE, OperationKeys.CREATE])(TaskModel);
BlockOperations([
  OperationKeys.UPDATE,
  OperationKeys.CREATE,
  OperationKeys.DELETE,
])(TaskEventModel);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(Product);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(Batch);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(ProductMarket);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(ProductStrength);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(ProductImage);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(LeafletFile);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(Leaflet);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(FabricIdentity);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
  { kind: "statement", value: PreparedStatementKeys.LIST_BY },
  { kind: "statement", value: PreparedStatementKeys.FIND },
  { kind: "statement", value: PreparedStatementKeys.FIND_ONE_BY },
  { kind: "statement", value: PreparedStatementKeys.PAGE },
  { kind: "statement", value: PreparedStatementKeys.FIND_BY },
  { kind: "statement", value: PreparedStatementKeys.PAGE_BY },
  { kind: "statement", value: "statement" },
])(History);
controllerConfig({ allowGroupingQueries: false })(History);
controllerConfig({ allowBulkStatement: false })(History);

import { Module } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { ApiPlaModule } from "./api/api-pla.module";
import { AppController } from "./app.controller";
import { ImpersonateHandler } from "./handlers/ImpersonateHandler";
import { ConfigService } from "./utils/config";

import { Logging } from "@decaf-ts/logging";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth";
import { FabricTransformer } from "./handlers/HLFabricRequestTransformer";
import { NanoTransformer } from "./handlers/NanoTransformer";
import { TypeORMTransformer } from "./handlers/TypeORMTransformer";
import { KibanaModule } from "./kibana/kibana.module";
import { Environment } from "./utils/environment";
import { EVENTS_API_PATH } from "./utils/constants";

const decafHandlers = [ImpersonateHandler as any];
const throttling = Environment.orThrow().throttling;
const adminEnv = AdminEnvironment.orThrow();
const env = Environment.orThrow();

const log = Logging.get();

const serializedEnv = JSON.parse(
  JSON.stringify(AdminEnvironment, undefined, 2)
);
log.debug(`environment: ${JSON.stringify(serializedEnv, null, 2)}`);

@Module({
  imports: [
    AuthModule,
    ApiPlaModule,
    DecafModule.forRootAsync({
      conf: [
        [
          FabricClientAdapter as any,
          {
            cryptoPath: adminEnv.fabric.cryptoPath,
            keyCertOrDirectoryPath: adminEnv.fabric.keyCertOrDirectoryPath,
            certCertOrDirectoryPath: adminEnv.fabric.certCertOrDirectoryPath,
            tlsCert: adminEnv.fabric.tlsCert,
            peerEndpoint: adminEnv.fabric.peerEndpoint,
            peerHostAlias: adminEnv.fabric.peerHostAlias,
            chaincodeName: adminEnv.fabric.chaincodeName,
            ca: adminEnv.fabric.ca,
            mspId: adminEnv.fabric.mspId,
            channel: adminEnv.fabric.channel,
            allowGatewayOverride: true,
            legacyMspCount: 2,
            mspMap: {
              BagacitoMSP: [
                {
                  endpoint:
                    process.env["FABRIC__MSP_MAP__0__ENDPOINT"] ||
                    "localhost:7050",
                  alias:
                    process.env["FABRIC__MSP_MAP__0__ALIAS"] ||
                    "bagacito-peer-0",
                  tlsCert:
                    process.env["FABRIC__MSP_MAP__0__TLS_CERT"] ||
                    "./docker/docker-data/pla-peer-0-tls.pem",
                },
                {
                  endpoint:
                    process.env["FABRIC__MSP_MAP__1__ENDPOINT"] ||
                    "localhost:7051",
                  alias:
                    process.env["FABRIC__MSP_MAP__1__ALIAS"] ||
                    "bagacito-peer-1",
                  tlsCert:
                    process.env["FABRIC__MSP_MAP__1__TLS_CERT"] ||
                    "./docker/docker-data/pla-peer-1-tls.pem",
                },
                {
                  endpoint:
                    process.env["FABRIC__MSP_MAP__2__ENDPOINT"] ||
                    "localhost:7052",
                  alias:
                    process.env["FABRIC__MSP_MAP__2__ALIAS"] ||
                    "bagacito-peer-2",
                  tlsCert:
                    process.env["FABRIC__MSP_MAP__2__TLS_CERT"] ||
                    "./docker/docker-data/pla-peer-2-tls.pem",
                },
              ],
            },
          } as unknown as PeerConfig,
          new FabricTransformer(),
        ],
        [
          TypeORMAdapter as any,
          {
            type: "postgres",
            host: adminEnv.database.postgres!.host, //TODO - for demo
            port: adminEnv.database.postgres!.port,
            database: adminEnv.database.postgres!.database,
            username: adminEnv.database.postgres!.user,
            password: adminEnv.database.postgres!.password,
            // env: DATABASE__POSTGRES__SYNCHRONIZE (toolkit config field);
            // cast keeps this forward-compatible with published toolkit
            // versions that predate the field (falls back to true)
            synchronize:
              (adminEnv.database.postgres as any)?.synchronize ?? true,
            logging: true,
          } as any,
          new TypeORMTransformer(),
        ],
        [
          NanoAdapter as any,
          {
            couchUser: adminEnv.database.couchdb!.user,
            couchPassword: adminEnv.database.couchdb!.password,
            host: `${adminEnv.database.couchdb!.host}:${adminEnv.database.couchdb!.port}`,
            dbName: adminEnv.database.couchdb!.database,
            protocol: adminEnv.database.couchdb!.protocol,
          } as any,
          new NanoTransformer(),
        ],
        [
          NanoAdapter as any,
          {
            couchUser: env.tasks.user,
            couchPassword: env.tasks.password,
            host: `${env.database.couchdb.host}:${env.database.couchdb.port}`,
            dbName: env.tasks.database,
            protocol: env.database.couchdb.protocol,
          } as any,
          "tasks",
          new NanoTransformer(),
        ],
      ],
      autoControllers: true,
      aggregations: false,
      observerOptions: {
        enableObserverEvents: true,
        // observerFlavours: [],
        observerFlavours: [FabricFlavour, "tasks"],
        observerApiPath: EVENTS_API_PATH,
        // the stream is otherwise open to anyone reaching the backend; see
        // FabricKeycloakAuthHandler.prime for its token-only binding
        authenticate: true,
      },
      handlers: decafHandlers,
      initialization: async () => {
        try {
          await Service.boot();
        } catch (err) {
          throw new InternalError(err);
        }
      },
    }),
    KibanaModule,
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: throttling.defaultTtlMs,
        limit: throttling.defaultLimit,
        skipIf: () => !throttling.enabled,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    ConfigService,
    {
      provide: NestConfigService,
      useExisting: ConfigService,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
