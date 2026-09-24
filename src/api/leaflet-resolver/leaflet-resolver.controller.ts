import { Auth, Service } from "@decaf-ts/for-nest";
import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  Product,
  ProductLeafletResolverService,
} from "@bagacito/lavajet-toolkit";
import { Environment } from "../../utils/environment";

@ApiTags("leaflet resolver api")
@Controller("leaflet-resolver")
@Auth(Product)
export class LeafletResolverController {
  constructor(
    @Service()
    private readonly productLeafletResolverService: ProductLeafletResolverService
  ) {}

  @Post("update/unresolved")
  @ApiOperation({
    summary: "Queue leaflet-resolver tasks for every unresolved product",
  })
  async updateUnresolvedProducts() {
    await this.productLeafletResolverService.queueUnresolvedProducts(
      Environment.serviceAccount
    );
    return { status: "completed" };
  }

  @Post("update/unresolved-without-leaflets")
  @ApiOperation({
    summary: "Queue leaflet-resolver tasks for every unresolved product",
  })
  async updateUnresolvedProductsWithoutLeaflets() {
    await this.productLeafletResolverService.queueUnresolvedProductsWithoutLeaflets(
      Environment.serviceAccount
    );
    return { status: "completed" };
  }

  @Post("update/:gtin")
  @ApiOperation({
    summary: "Synchronously discover and store a leaflet resolver for a GTIN",
  })
  @ApiParam({
    name: "gtin",
    type: String,
    description: "GTIN of the product to resolve",
  })
  async updateForGtin(@Param("gtin") gtin: string) {
    return await this.productLeafletResolverService.resolveProduct(gtin);
  }
}
