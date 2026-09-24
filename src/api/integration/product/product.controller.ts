/**
 * @module ew-backend/api/integration/product
 * @description This module defines the product controller for the integration API.
 * @summary It provides endpoints for creating, updating, and retrieving product information.
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
import { Leaflet, Product } from "@bagacito/lavajet-toolkit";
import { Repo, Repository } from "@decaf-ts/core";
import {
  NotFoundError,
  OperationKeys,
  ValidationError,
} from "@decaf-ts/db-decorators";
import {
  Auth,
  DecafModelController,
  DecafRequestContext,
} from "@decaf-ts/for-nest";
import { ModelConstructor } from "@decaf-ts/decorator-validation";
import { IntegrationProduct } from "../utils/IntegrationProduct";

@UseInterceptors(DeprecatedInterceptor)
@ApiTags("/integration Product")
@Controller("product")
@Auth(Product)
export class IntegrationProductController extends DecafModelController<Product> {
  pk: keyof Product = "productCode" as const;

  override get class(): ModelConstructor<Product> {
    return Product;
  }

  private _leafletRepo!: Repo<Leaflet>;

  private get leafletRepo() {
    if (!this._leafletRepo)
      this._leafletRepo = Repository.forModel(Leaflet).override(
        this.clientContext.toOverrides()
      );
    return this._leafletRepo;
  }

  constructor(clientContext: DecafRequestContext) {
    super(clientContext, "ProductLegacyController");
  }

  @Put(":productCode")
  @ApiOperation({
    summary: "Create or update a product by code",
    deprecated: true,
  })
  @ApiBody({ type: IntegrationProduct })
  async createOrUpdatePut(
    @Param("productCode") productCode: string,
    @Body() body: IntegrationProduct
  ) {
    return this.upsertProduct(productCode, body);
  }

  @Post(":productCode")
  @ApiOperation({
    summary: "Create or update a product by code",
    deprecated: true,
  })
  @ApiBody({ type: IntegrationProduct })
  async createOrUpdatePost(
    @Param("productCode") productCode: string,
    @Body() body: IntegrationProduct
  ) {
    return this.upsertProduct(productCode, body);
  }

  private async upsertProduct(
    productCode: string,
    body: IntegrationProduct
  ) {
    const payload = new IntegrationProduct(body);
    const product = payload.transform();
    if (productCode !== product.productCode)
      throw new ValidationError(
        `Product code in path (${productCode}) does not match code in body (${product.productCode})`
      );
    const { ctx } = (await this.logCtx([], OperationKeys.CREATE, true)).for(
      this.upsertProduct
    );
    try {
      await this.persistence(this.clientContext).read(productCode, ctx);
      const productUpdate = await this.persistence(this.clientContext).update(
        product,
        ctx
      );
      return payload.revert(productUpdate);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      const productCreate = await this.persistence(this.clientContext).create(
        product,
        ctx
      );
      return payload.revert(productCreate);
    }
  }

  /**
   * @method getOne
   * @description Retrieves a product by its code.
   * @param {string} productCode - The product code.
   * @returns {Promise<Product>} The product.
   */
  @Get(":productCode")
  @ApiOperation({
    summary: "Get one product by code",
    deprecated: true,
  })
  async getOne(@Param("productCode") productCode: string) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.getOne
    );
    const product = await this.persistence(this.clientContext).read(
      productCode,
      ctx
    );
    return new IntegrationProduct().revert(product);
  }

  // /**
  //  * @method getAllProducts
  //  * @description Retrieves all products.
  //  * @returns {Promise<Product[]>} A list of all products.
  //  */
  // @Get()
  // @ApiOperation({ summary: "Get all products", deprecated: true })
  // async getAllProducts() {
  //   const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
  //     this.getAllProducts
  //   );
  //   return this.persistence(ctx).select().execute();
  // }

  // /**
  //  * @method getProductLangs
  //  * @description Retrieves the languages for a product's EPIs.
  //  * @param {string} productCode - The product code.
  //  * @param {string} epiType - The EPI type.
  //  * @returns {Promise<string[]>} A list of languages.
  //  */
  // @Get(":productCode/langs/:epiType")
  // @ApiOperation({ summary: "Get product langs", deprecated: true })
  // async getProductLangs(
  //   @Param("productCode") productCode: string,
  //   @Param("epiType") epiType: string
  // ) {
  //   const leaflets = await this.leafletRepo
  //     .select()
  //     .where(this.leafletRepo.attr("productCode").eq(productCode))
  //     .execute();

  //   return [
  //     ...new Set(
  //       leaflets.filter((l) => l.leafletType === epiType).map((l) => l.lang)
  //     ),
  //   ];
  // }

  // /**
  //  * @method getProductMarkets
  //  * @description Retrieves the markets for a product.
  //  * @param {string} productCode - The product code.
  //  * @param {string} epiType - The EPI type.
  //  * @returns {Promise<string[]>} A list of markets.
  //  */
  // @Get(":productCode/markets/:epiType")
  // @ApiOperation({
  //   summary: "Get product markets",
  //   deprecated: true,
  // })
  // async getProductMarkets(
  //   @Param("productCode") productCode: string,
  //   @Param("epiType") _epiType: string // TODO @pedro o que dava isto antes?
  // ) {
  //   const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
  //     this.getProductMarkets
  //   );
  //   const product = await this.persistence(ctx).read(productCode);
  //   return product.markets;
  // }
}
