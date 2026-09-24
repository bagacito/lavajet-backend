/**
 * @module ew-backend/api/integration/image
 * @description This module defines the image controller for the integration API.
 * @summary It provides endpoints for uploading, updating, and retrieving product images.
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
import { DeprecatedInterceptor } from "../../../interceptors";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Product, ProductImage } from "@bagacito/lavajet-toolkit";
import { OperationKeys, ValidationError } from "@decaf-ts/db-decorators";
import {
  Auth,
  DecafModelController,
  DecafRequestContext,
} from "@decaf-ts/for-nest";
import { ModelConstructor } from "@decaf-ts/decorator-validation";
import { IntegrationImage } from "../utils/IntegrationImage";
import { Repository } from "@decaf-ts/core";

@UseInterceptors(DeprecatedInterceptor)
@ApiTags("/integration Image")
@Controller("image")
@Auth(ProductImage)
export class IntegrationImageController extends DecafModelController<Product> {
  pk: keyof Product = "productCode" as const;

  override get class(): ModelConstructor<Product> {
    return Product;
  }

  constructor(clientContext: DecafRequestContext) {
    super(clientContext, "ImageLegacyController");
  }

  private _imageRepo!: any;
  private get imageRepo() {
    if (!this._imageRepo)
      this._imageRepo = Repository.forModel(ProductImage).override(
        this.clientContext.toOverrides()
      );
    return this._imageRepo;
  }

  /**
   * @method uploadImage
   * @description Uploads a product image.
   * @param {string} productCode - The product code.
   * @param {Buffer} image - The image buffer.
   */
  @Post(":productCode")
  @ApiOperation({
    summary: "Upload product image",
    deprecated: true,
  })
  @ApiBody({ type: IntegrationImage })
  uploadImagePost(
    @Param("productCode") productCode: string,
    @Body() body: IntegrationImage
  ) {
    return this.uploadImage(productCode, body);
  }

  @Put(":productCode")
  @ApiOperation({
    summary: "Upload product image",
    deprecated: true,
  })
  @ApiBody({ type: IntegrationImage })
  uploadImagePut(
    @Param("productCode") productCode: string,
    @Body() body: IntegrationImage
  ) {
    return this.uploadImage(productCode, body);
  }

  private uploadImage(productCode: string, body: IntegrationImage) {
    const payload = new IntegrationImage(body);
    const image = payload.transform();
    return this.upsertImage(productCode, image);
  }

  /**
   * @method getImage
   * @description Retrieves a product image.
   * @param {string} productCode - The product code.
   * @throws {Error} Not implemented.
   */
  @Get(":productCode")
  @ApiOperation({
    summary: "Retrieve product image",
    deprecated: true,
  })
  getImage(@Param("productCode") productCode: string) {
    return this.readImage(productCode);
  }

  private async upsertImage(productCode: string, image: ProductImage) {
    if (image.productCode && image.productCode !== productCode)
      throw new ValidationError(
        `Product code in path (${productCode}) does not match code in body (${image.productCode})`
      );

    const { ctx } = (await this.logCtx([], OperationKeys.UPDATE, true)).for(
      this.upsertImage
    );
    const product = await this.persistence(this.clientContext).read(
      productCode,
      ctx
    );
    product.imageData = new ProductImage({
      ...image,
      productCode,
    });
    const updatedProduct = await this.persistence(this.clientContext).update(
      product,
      ctx
    );
    return await this.imageRepo.read(productCode);
  }

  private async readImage(productCode: string) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.readImage
    );
    const productImage = await this.imageRepo.read(productCode);
    return productImage;
  }
}
