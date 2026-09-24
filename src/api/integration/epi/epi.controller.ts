/**
 * @module ew-backend/api/integration/epi
 * @description This module defines the ePI controller for the integration API.
 * @summary It provides endpoints for creating, updating, retrieving, and deleting ePIs.
 * @category API
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseInterceptors,
} from "@nestjs/common";
import { DeprecatedInterceptor } from "../../../interceptors";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Context, Service } from "@decaf-ts/core";
import {
  Leaflet,
  LeafletService,
  LeafletType,
} from "@bagacito/lavajet-toolkit";
import { OperationKeys, ValidationError } from "@decaf-ts/db-decorators";
import {
  Auth,
  DecafModelController,
  DecafRequestContext,
} from "@decaf-ts/for-nest";
import { Model, ModelConstructor } from "@decaf-ts/decorator-validation";
import { IntegrationEpi } from "../utils/IntegrationEpi";

@UseInterceptors(DeprecatedInterceptor)
@ApiTags("/integration ePI")
@Controller("epi")
@Auth(Leaflet)
export class IntegrationEpiController extends DecafModelController<Leaflet> {
  pk: keyof Leaflet = "id" as const;
  private readonly leafletTypes = new Set(
    Object.values(LeafletType) as string[]
  );

  private isLeafletType(value: string): value is LeafletType {
    return this.leafletTypes.has(value);
  }

  override get class(): ModelConstructor<Leaflet> {
    return Leaflet;
  }
  constructor(clientContext: DecafRequestContext) {
    super(clientContext, "LeafletGetController");
  }

  @Get(":productCode/:batchNumberOrLang/:langOrLeafletType/:epiTypeorEpiMarket")
  @ApiOperation({ summary: "Retrieve a leaflet", deprecated: true })
  async read(
    @Param("productCode") productCode: string,
    @Param("batchNumberOrLang") batchNumberOrLang: string,
    @Param("langOrLeafletType") langOrLeafletType: string,
    @Param("epiTypeorEpiMarket") epiTypeorEpiMarket: string
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.read
    );
    if (this.isLeafletType(epiTypeorEpiMarket)) {
      return this.fetchLeaflet(
        ctx,
        productCode,
        langOrLeafletType,
        epiTypeorEpiMarket,
        batchNumberOrLang
      );
    }
    return this.fetchLeaflet(
      ctx,
      productCode,
      batchNumberOrLang,
      langOrLeafletType,
      undefined,
      epiTypeorEpiMarket
    );
  }

  @Get(":productCode/:language/:epiType")
  @ApiOperation({ summary: "Retrieve a leaflet", deprecated: true })
  async readWithoutLangOrEpiMarket(
    @Param("productCode") productCode: string,
    @Param("language") language: string,
    @Param("epiType") epiType: string
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.readWithoutLangOrEpiMarket
    );
    return this.fetchLeaflet(ctx, productCode, language, epiType);
  }

  private async fetchLeaflet(
    ctx: Context<any>,
    productCode: string,
    language: string,
    epiType: string,
    batchNumber?: string,
    epiMarket?: string
  ) {
    const log = ctx.logger;

    const separator = Model.composed(Leaflet, this.pk)?.separator;
    const id = [productCode, batchNumber, epiType, language, epiMarket]
      .filter(Boolean)
      .join(separator || ":");

    let read: Leaflet;
    try {
      const persistence = this.persistence(this.clientContext);
      read = await persistence.read(id, ctx);
    } catch (e: unknown) {
      log.error(`Failed to read Leaflet with ${this.pk} ${id}`, e as Error);
      throw e;
    }
    log.info(`read Leaflet with id ${(read as any)[this.pk]}`);
    return read;
  }

  @Put(":productCode/:batchNumberOrLang/:langOrLeafletType/:epiTypeorEpiMarket")
  @ApiOperation({ summary: "Update a leaflet", deprecated: true })
  @ApiBody({ type: IntegrationEpi })
  async update(
    @Body() data: IntegrationEpi,
    @Param("productCode") productCode: string,
    @Param("batchNumberOrLang") batchNumberOrLang: string,
    @Param("langOrLeafletType") langOrLeafletType: string | LeafletType,
    @Param("epiTypeorEpiMarket") epiTypeorEpiMarket: string | LeafletType
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.update
    );

    if (this.isLeafletType(epiTypeorEpiMarket)) {
      return this.updateLeaflet(
        ctx,
        data,
        productCode,
        langOrLeafletType,
        epiTypeorEpiMarket,
        batchNumberOrLang
      );
    }
    return this.updateLeaflet(
      ctx,
      data,
      productCode,
      batchNumberOrLang,
      langOrLeafletType,
      undefined,
      epiTypeorEpiMarket
    );
  }

  @Post(
    ":productCode/:batchNumberOrLang/:langOrLeafletType/:epiTypeorEpiMarket"
  )
  @ApiOperation({ summary: "Create or Update a leaflet", deprecated: true })
  @ApiBody({ type: IntegrationEpi })
  async updatePost(
    @Body() data: IntegrationEpi,
    @Param("productCode") productCode: string,
    @Param("batchNumberOrLang") batchNumberOrLang: string,
    @Param("langOrLeafletType") langOrLeafletType: string | LeafletType,
    @Param("epiTypeorEpiMarket") epiTypeorEpiMarket: string | LeafletType
  ) {
    return this.update(
      data,
      productCode,
      batchNumberOrLang,
      langOrLeafletType,
      epiTypeorEpiMarket
    );
  }

  @Put(":productCode/:language/:epiType")
  @ApiOperation({ summary: "Update a leaflet", deprecated: true })
  @ApiBody({ type: IntegrationEpi })
  async updateWithoutLangOrEpiMarket(
    @Body() data: IntegrationEpi,
    @Param("productCode") productCode: string,
    @Param("language") language: string,
    @Param("epiType") epiType: string
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.updateWithoutLangOrEpiMarket
    );
    if (!this.isLeafletType(epiType))
      throw new ValidationError(`Invalid epiType: ${epiType}`);
    return this.updateLeaflet(ctx, data, productCode, language, epiType);
  }

  @Post(":productCode/:language/:epiType")
  @ApiOperation({ summary: "Create or Update a leaflet", deprecated: true })
  @ApiBody({ type: IntegrationEpi })
  async updateWithoutLangOrEpiMarketPost(
    @Body() data: IntegrationEpi,
    @Param("productCode") productCode: string,
    @Param("language") language: string,
    @Param("epiType") epiType: string
  ) {
    return this.updateWithoutLangOrEpiMarket(
      data,
      productCode,
      language,
      epiType
    );
  }

  private async updateLeaflet(
    ctx: Context<any>,
    data: IntegrationEpi,
    productCode: string,
    language: string,
    epiType: string,
    batchNumber?: string,
    epiMarket?: string
  ) {
    const log = ctx.logger;
    const epi = new IntegrationEpi(data);
    const leaflet = epi.transform(epiType as LeafletType);
    if (productCode !== leaflet.productCode)
      throw new ValidationError("Product codes do not match");
    if (language !== leaflet.lang)
      throw new ValidationError("Language codes do not match");
    if (epiMarket && epiMarket !== leaflet.epiMarket)
      throw new ValidationError("Epi markets do not match");

    const separator = Model.composed(Leaflet, this.pk)?.separator;
    const id = [productCode, batchNumber, epiType, language, epiMarket]
      .filter(Boolean)
      .join(separator || ":");

    let read: Leaflet;
    try {
      const persistence = this.persistence(this.clientContext);
      read = await persistence.read(id, ctx);
      return persistence.update(leaflet, ctx);
    } catch (error) {
      return this.persistence(this.clientContext).create(leaflet, ctx);
    }
  }

  @Delete(
    ":productCode/:batchNumberOrLang/:langOrLeafletType/:epiTypeorEpiMarket"
  )
  @ApiOperation({ summary: "Delete a leaflet", deprecated: true })
  async delete(
    @Param("productCode") productCode: string,
    @Param("batchNumberOrLang") batchNumberOrLang: string,
    @Param("langOrLeafletType") langOrLeafletType: string,
    @Param("epiTypeorEpiMarket") epiTypeorEpiMarket: string
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.delete
    );
    if (this.isLeafletType(epiTypeorEpiMarket)) {
      return this.deleteLeaflet(
        ctx,
        productCode,
        langOrLeafletType,
        epiTypeorEpiMarket,
        batchNumberOrLang
      );
    }
    return this.deleteLeaflet(
      ctx,
      productCode,
      batchNumberOrLang,
      langOrLeafletType,
      undefined,
      epiTypeorEpiMarket
    );
  }

  @Delete(":productCode/:language/:epiType")
  @ApiOperation({ summary: "Delete a leaflet", deprecated: true })
  async deleteWithoutLangOrEpiMarket(
    @Param("productCode") productCode: string,
    @Param("language") language: string,
    @Param("epiType") epiType: string
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.deleteWithoutLangOrEpiMarket
    );
    return this.deleteLeaflet(ctx, productCode, language, epiType);
  }

  private async deleteLeaflet(
    ctx: Context<any>,
    productCode: string,
    language: string,
    epiType: string,
    batchNumber?: string,
    epiMarket?: string
  ) {
    const log = ctx.logger;

    const separator = Model.composed(Leaflet, this.pk)?.separator;
    const id = [productCode, batchNumber, epiType, language, epiMarket]
      .filter(Boolean)
      .join(separator || ":");

    let read: Leaflet;
    try {
      const persistence = this.persistence(this.clientContext);
      read = await persistence.delete(id, ctx);
    } catch (e: unknown) {
      log.error(`Failed to delete Leaflet with ${this.pk} ${id}`, e as Error);
      throw e;
    }
    log.info(`Deleted Leaflet with id ${(read as any)[this.pk]}`);
    return read;
  }
}
