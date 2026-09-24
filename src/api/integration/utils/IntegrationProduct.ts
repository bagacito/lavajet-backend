import {
  Product,
  ProductMarket,
  ProductStrength,
} from "@bagacito/lavajet-toolkit";
import { IntegrationBody } from "./IntegrationBody";
import { Market, ProductPayload, Strength } from "./types";
import { ApiProperty } from "@nestjs/swagger";

export class IntegrationProduct extends IntegrationBody<
  ProductPayload,
  Product
> {
  @ApiProperty({ type: ProductPayload })
  declare payload: ProductPayload;

  constructor(data?: Partial<IntegrationProduct>) {
    super(Product.name, data);
  }
  override transform(): Product {
    const product = new Product();
    product.productCode = this.payload.productCode;
    product.inventedName = this.payload.inventedName;
    product.nameMedicinalProduct = this.payload.nameMedicinalProduct;
    product.internalMaterialCode = this.payload.internalMaterialCode;
    product.productRecall = this.payload.productRecall;
    if (this.payload.strengths) {
      product.strengths = this.payload.strengths.map((strength) => {
        return new ProductStrength({
          substance: strength.substance,
          strength: strength.strength,
        });
      });
    }
    if (this.payload.markets) {
      product.markets = this.payload.markets.map((market) => {
        return new ProductMarket({
          marketId: market.marketId,
          nationalCode: market.nationalCode,
          mahAddress: market.mahAddress,
          mahName: market.mahName,
          legalEntityName: market.legalEntityName,
        });
      });
    }
    return product;
  }
  override revert(product: Product): ProductPayload {
    const payload = new ProductPayload();
    payload.productCode = product.productCode;
    payload.inventedName = product.inventedName;
    payload.nameMedicinalProduct = product.nameMedicinalProduct;
    payload.internalMaterialCode = product.internalMaterialCode!;
    payload.productRecall = product.productRecall;
    if (product.strengths.length > 0) {
      payload.strengths = product.strengths.map((strength) => {
        return {
          substance: strength.substance,
          strength: strength.strength,
        } as Strength;
      });
    }
    if (product.markets.length > 0) {
      payload.markets = product.markets.map((market) => {
        return {
          marketId: market.marketId,
          nationalCode: market.nationalCode,
          mahAddress: market.mahAddress,
          mahName: market.mahName,
          legalEntityName: market.legalEntityName,
        } as Market;
      });
    }
    return payload;
  }
}
