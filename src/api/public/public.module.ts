/**
 * @module ew-backend/api/public
 * @description This module defines the public-facing API endpoints.
 * @summary It registers the public routes and controllers.
 * @category API
 */

import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";
import { PublicLeafletResolverController } from "./leaflet-resolver/public-leaflet-resolver.controller";
import { LeafletController } from "./leaflet/leaflet.controller";
import { MetadataController } from "./metadata/metadata.controller";
import { OwnerController } from "./owner/owner.controller";

@Module({
  imports: [
    RouterModule.register([
      {
        path: "public",
        module: PublicModule,
      },
    ]),
  ],
  controllers: [
    OwnerController,
    MetadataController,
    LeafletController,
    PublicLeafletResolverController,
  ],
  providers: [],
})
export class PublicModule {}
