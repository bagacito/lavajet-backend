/**
 * @module backend
 * @description This is the main application module for the PLA (PharmaLedger Association) specific backend.
 * @summary It imports and configures all the necessary modules for the PLA application.
 * @category Application
 */

import {
  Service,
} from "@decaf-ts/core";
import {
  InternalError,
} from "@decaf-ts/db-decorators";
import { TypeORMAdapter } from "@decaf-ts/for-typeorm";
import { DecafModule } from "@decaf-ts/for-nest";
import {
  AdminEnvironment,
} from "@bagacito/lavajet-toolkit";
import { Module } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { ApiModule } from "./api/api.module";
import { AppController } from "./app.controller";
import { ImpersonateHandler } from "./handlers/ImpersonateHandler";
import { ConfigService } from "./utils/config";
import { Logging } from "@decaf-ts/logging";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth";
import { TypeORMTransformer } from "./handlers/TypeORMTransformer";
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
    ApiModule,
    DecafModule.forRootAsync({
      conf: [
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
        ]
      ],
      autoControllers: true,
      aggregations: false,
      observerOptions: {
        enableObserverEvents: true,
        observerFlavours: [],
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
