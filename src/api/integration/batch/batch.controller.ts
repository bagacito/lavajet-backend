/**
 * @module ew-backend/api/integration/batch
 * @description This module defines the batch controller for the integration API.
 * @summary It provides endpoints for creating, updating, and retrieving batch information.
 * @category API
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DeprecatedInterceptor } from "../../../interceptors";
import { Repo, Repository } from "@decaf-ts/core";
import { Batch, Leaflet } from "@bagacito/lavajet-toolkit";
import {
  NotFoundError,
  OperationKeys,
  ValidationError,
} from "@decaf-ts/db-decorators";
import {
  Auth,
  DecafModelController,
  DecafRequestContext,
  DtoFor,
} from "@decaf-ts/for-nest";
import { ModelConstructor } from "@decaf-ts/decorator-validation";
import { getLoggerFor } from "../../../utils/logging";
import { IntegrationBatch } from "../utils/IntegrationBatch";

export type LegacyRes = Response & {
  setHeader: (key: string, value: string) => void;
  json: (response: any) => any;
};

@UseInterceptors(DeprecatedInterceptor)
@ApiTags("/integration Batch")
@Controller("batch")
@Auth(Batch)
export class IntegrationBatchController extends DecafModelController<Batch> {
  pk: keyof Batch = "id" as const;

  override get class(): ModelConstructor<Batch> {
    return Batch;
  }
  constructor(clientContext: DecafRequestContext) {
    super(clientContext, "BatchLegacyController");
  }

  private _leafletRepo!: Repo<Leaflet>;

  private get leafletRepo() {
    if (!this._leafletRepo)
      this._leafletRepo = Repository.forModel(Leaflet).override(
        this.clientContext.toOverrides()
      );
    return this._leafletRepo;
  }

  /**
   * @method createBatch
   * @description Creates a new batch.
   * @param {string} productCode - The product code.
   * @param {string} batchNumber - The batch number.
   * @param {Batch} model - The batch data transfer object.
   * @returns {Promise<Batch>} The created batch.
   * @throws {ValidationError} If the product code and batch number do not match the model.
   */
  @Post(":productCode/:batchNumber")
  @ApiOperation({
    summary: "Create batch",
    description: `
      This legacy endpoint handles batch creation.  
      It is **deprecated** and will be removed in future versions.  
      Use **POST /batches** instead.

      The response includes a \`Deprecation\` header and a \`Link\` header pointing
      to the new endpoint.
    `,
    deprecated: true,
  })
  @ApiBody({ type: IntegrationBatch })
  async createBatchPost(
    @Param("productCode") productCode: string,
    @Param("batchNumber") batchNumber: string,
    @Body() body: IntegrationBatch
  ) {
    return this.upsertBatch(productCode, batchNumber, body);
  }

  @Put(":productCode/:batchNumber")
  @ApiOperation({
    summary: "Create batch",
    description: `
      This legacy endpoint handles batch creation.  
      It is **deprecated** and will be removed in future versions.  
      Use **POST /batches** instead.

      The response includes a \`Deprecation\` header and a \`Link\` header pointing
      to the new endpoint.
    `,
    deprecated: true,
  })
  @ApiBody({ type: IntegrationBatch })
  async createBatchPut(
    @Param("productCode") productCode: string,
    @Param("batchNumber") batchNumber: string,
    @Body() body: IntegrationBatch
  ) {
    return this.upsertBatch(productCode, batchNumber, body);
  }

  private async upsertBatch(
    productCode: string,
    batchNumber: string,
    body: IntegrationBatch
  ) {
    const payload = new IntegrationBatch(body);
    const batch = payload.transform();
    const { ctx, log } = (
      await this.logCtx([], OperationKeys.CREATE, true)
    ).for(this.upsertBatch);

    const logger = getLoggerFor(log, ctx);
    logger.info(`DEPRECATION`);

    if (productCode !== batch.productCode || batchNumber !== batch.batchNumber)
      throw new ValidationError(
        "Product code and batch number must match model"
      );

    const id = [productCode, batchNumber].join(":");
    try {
      await this.persistence(this.clientContext).read(id, ctx);
      batch.id = id;
      return this.persistence(this.clientContext).update(batch, ctx);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      return this.persistence(this.clientContext).create(batch, ctx);
    }
  }

  /**
   * @method getBatch
   * @description Retrieves batch details.
   * @param {string} productCode - The product code.
   * @param {string} batchNumber - The batch number.
   * @returns {Promise<Batch>} The batch.
   */
  @Get(":productCode/:batchNumber")
  @ApiOperation({
    summary: "Get batch details",
    description: `
      This legacy endpoint retrieves batch information. It is *deprecated* and will be removed in future versions.  
      Use **GET /batch/:id** instead.

      The response includes a \`Deprecation\` header and a \`Link\` header pointing
      to the new endpoint.
    `,
    deprecated: true,
  })
  async getBatch(
    @Param("productCode") productCode: string,
    @Param("batchNumber") batchNumber: string
  ) {
    const { ctx, log } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.getBatch
    );

    const logger = getLoggerFor(log, ctx);
    const batch = await this.persistence(this.clientContext).read(
      [productCode, batchNumber].join(":"),
      ctx
    );
    return new IntegrationBatch().revert(batch);
  }
}
