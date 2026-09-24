/**
 * @module ew-backend/api-pla
 * @description This module aggregates all the API-related modules for the PLA-specific backend.
 * @summary It imports and exports all the necessary modules for the PLA API.
 * @category API
 */

import { DecafModule } from "@decaf-ts/for-nest";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { AuthController } from "./auth/auth.controller";

// const controllers: Type<any>[] = [
//   AccountController,
//   ...(Environment.environment === "local" ? [AuthController] : []),
// ];
@Module({
  imports: [AuthModule, DecafModule],
  providers: [],
  controllers: [
    AuthController,
  ],
})
export class ApiModule {}
