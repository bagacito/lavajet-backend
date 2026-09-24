/**
 * @module ew-backend/api/integration
 * @description This module defines the integration API endpoints.
 * @summary It registers the integration routes and controllers.
 * @category API
 */

import { Module } from "@nestjs/common";
import { IntegrationProductController } from "./product/product.controller";
import { IntegrationImageController } from "./image/image.controller";
import { IntegrationAuditController } from "./audit/audit.controller";
import { IntegrationBatchController } from "./batch/batch.controller";
import { IntegrationEpiController } from "./epi/epi.controller";
import { IntegrationLegacyRoutesController } from "./integration.controller";
import { RouterModule } from "@nestjs/core";

@Module({
  imports: [
    RouterModule.register([
      {
        path: "integration",
        module: IntegrationModule,
      },
    ]),
  ],
  providers: [],
  controllers: [
    IntegrationAuditController,
    IntegrationBatchController,
    IntegrationEpiController,
    IntegrationImageController,
    IntegrationLegacyRoutesController,
    IntegrationProductController,
  ],
})
export class IntegrationModule {}
