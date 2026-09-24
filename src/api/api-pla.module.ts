/**
 * @module ew-backend/api-pla
 * @description This module aggregates all the API-related modules for the PLA-specific backend.
 * @summary It imports and exports all the necessary modules for the PLA API.
 * @category API
 */

import { DecafModule } from "@decaf-ts/for-nest";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { AccountPlaController } from "./account/account-pla.controller";
import { AuthController } from "./auth/auth.controller";
import { InfrastructurePLAController } from "./infrastructure/infrastructure-pla.controller";
import { PublicPlaModule } from "./public/public-pla.module";

// const controllers: Type<any>[] = [
//   AccountController,
//   ...(Environment.environment === "local" ? [AuthController] : []),
// ];
@Module({
  imports: [AuthModule, DecafModule, PublicPlaModule],
  providers: [],
  controllers: [
    AuthController,
    AccountPlaController,
    InfrastructurePLAController,
  ],
})
export class ApiPlaModule {}
