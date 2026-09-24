/**
 * @module ew-backend/api
 * @description This module aggregates all the API-related modules.
 * @summary It imports and exports all the necessary modules for the API.
 * @category API
 */
import { Module } from "@nestjs/common";
import { IntegrationModule } from "./integration/integration.module";
import { AuthController } from "./auth/auth.controller";
import { AccountController } from "./account/account.controller";
import { PublicModule } from "./public/public.module";
import { DecafModule } from "@decaf-ts/for-nest";
import { AuthModule } from "../auth";
import { InfrastructureController } from "./infrastructure/infrastructure.controller";
import { LeafletResolverController } from "./leaflet-resolver/leaflet-resolver.controller";

@Module({
  imports: [AuthModule, DecafModule, PublicModule, IntegrationModule],
  providers: [],
  controllers: [
    AuthController,
    AccountController,
    InfrastructureController,
    LeafletResolverController,
  ],
})
export class ApiModule {}
