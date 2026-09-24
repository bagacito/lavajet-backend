/**
 * @module ew-backend/app
 * @description This is the main application module for the ew-backend.
 * @summary It imports and configures all the necessary modules for the application.
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
import { controllerConfig, DecafModule } from "@decaf-ts/for-nest";
import { Logging } from "@decaf-ts/logging";
import { Module } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import {
  AccountConfig,
  Batch,
  Entity,
  FabricIdentity,
  History,
  LeafletFile,
  LeafletResolver,
  Product,
  ProductImage,
  ProductMarket,
  ProductStrength,
  LavajetModule,
  LavajetModuleFeature,
} from "@bagacito/lavajet-toolkit";
import { ApiModule } from "./api/api.module";
import { AppController } from "./app.controller";
import { FabricTransformer } from "./handlers/HLFabricRequestTransformer";
import { ImpersonateHandler } from "./handlers/ImpersonateHandler";
import { NanoTransformer } from "./handlers/NanoTransformer";
import { ConfigService } from "./utils/config";
import { Environment } from "./utils/environment";
import { EVENTS_API_PATH } from "./utils/constants";

import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth";
import { KibanaModule } from "./kibana/kibana.module";
import { ScheduleModule } from "@nestjs/schedule";
import { ResolverTasksService } from "./utils/ResolverTaskService";

uses(NanoFlavour)(FabricIdentity);

// order like this on purpose.  first, the all adapters, then models (if any), then all te nest
BlockOperations([OperationKeys.UPDATE, OperationKeys.CREATE])(TaskModel);
BlockOperations([
  OperationKeys.UPDATE,
  OperationKeys.CREATE,
  OperationKeys.DELETE,
])(TaskEventModel);
BlockOperations([
  OperationKeys.UPDATE,
  OperationKeys.CREATE,
  OperationKeys.DELETE,
])(Entity);
BlockOperations([
  OperationKeys.UPDATE,
  OperationKeys.CREATE,
  OperationKeys.DELETE,
])(AccountConfig);
BlockOperations([
  OperationKeys.UPDATE,
  OperationKeys.CREATE,
  OperationKeys.DELETE,
])(LavajetModule);
BlockOperations([
  OperationKeys.UPDATE,
  OperationKeys.CREATE,
  OperationKeys.DELETE,
])(LavajetModuleFeature);
BlockOperations([
  OperationKeys.CREATE,
  OperationKeys.UPDATE,
  OperationKeys.DELETE,
])(LeafletResolver);
BlockOperations([OperationKeys.DELETE])(LeafletFile);
BlockOperations([OperationKeys.DELETE])(Product);
BlockOperations([OperationKeys.DELETE])(Batch);
BlockOperations([OperationKeys.DELETE])(ProductMarket);
BlockOperations([OperationKeys.DELETE])(ProductStrength);
BlockOperations([OperationKeys.DELETE])(ProductImage);
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

const decafHandlers = [ImpersonateHandler as any];
const throttling = Environment.orThrow().throttling;

const log = Logging.get();
const env = JSON.parse(JSON.stringify(Environment, undefined, 2));
log.debug(`environment: ${JSON.stringify(env, null, 2)}`);

@Module({
  imports: [
    AuthModule,
    ApiModule,
    DecafModule.forRootAsync({
      conf: [
        [
          FabricClientAdapter as any,
          {
            cryptoPath: Environment.orThrow().fabric.cryptoPath,
            keyCertOrDirectoryPath:
              Environment.orThrow().fabric.keyCertOrDirectoryPath,
            certCertOrDirectoryPath:
              Environment.orThrow().fabric.certCertOrDirectoryPath,
            tlsCert: Environment.orThrow().fabric.tlsCert,
            peerEndpoint: Environment.orThrow().fabric.peerEndpoint,
            peerHostAlias: Environment.orThrow().fabric.peerHostAlias,
            chaincodeName: Environment.orThrow().fabric.chaincodeName,
            ca: Environment.orThrow().fabric.ca,
            mspId: Environment.orThrow().fabric.mspId,
            channel: Environment.orThrow().fabric.channel,
            allowGatewayOverride: Environment.orThrow().fabric.preferLegacy,
            legacyMspCount: 2,
            mspMap: {
              BagacitoMSP: [
                {
                  endpoint:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__0__ENDPOINT"
                    ] || "localhost:7050",
                  alias:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__0__ALIAS"
                    ] || "bagacito-peer-0",
                  tlsCert:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__0__TLS_CERT"
                    ] || "./docker/docker-data/pla-peer-0-tls.pem",
                },
                {
                  endpoint:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__1__ENDPOINT"
                    ] || "localhost:7051",
                  alias:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__1__ALIAS"
                    ] || "bagacito-peer-1",
                  tlsCert:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__1__TLS_CERT"
                    ] || "./docker/docker-data/pla-peer-1-tls.pem",
                },
                {
                  endpoint:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__2__ENDPOINT"
                    ] || "localhost:7052",
                  alias:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__2__ALIAS"
                    ] || "bagacito-peer-2",
                  tlsCert:
                    process.env[
                      "FABRIC__MSP_MAP__BAGACITOMSP__2__TLS_CERT"
                    ] || "./docker/docker-data/pla-peer-2-tls.pem",
                },
              ],
            },
          } as unknown as PeerConfig,
          new FabricTransformer(),
        ],
        [
          NanoAdapter as any,
          {
            couchUser: Environment.orThrow().database.couchdb.user,
            couchPassword: Environment.orThrow().database.couchdb.password,
            host: `${Environment.orThrow().database.couchdb.host}:${Environment.database.couchdb.port}`,
            dbName: Environment.orThrow().database.couchdb.database,
            protocol: Environment.orThrow().database.couchdb.protocol,
          } as any,
          new NanoTransformer(),
        ],
        [
          NanoAdapter as any,
          {
            couchUser: Environment.orThrow().tasks.user,
            couchPassword: Environment.orThrow().tasks.password,
            host: `${Environment.orThrow().database.couchdb.host}:${Environment.database.couchdb.port}`,
            dbName: Environment.orThrow().tasks.database,
            protocol: Environment.orThrow().database.couchdb.protocol,
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
    ScheduleModule.forRoot(),
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
    ResolverTasksService,
  ],
})
export class AppModule {}
