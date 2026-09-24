import {
  Leaflet,
  LeafletFile,
  ProductImage,
} from "@bagacito/lavajet-toolkit";
import { IntegrationBody } from "./IntegrationBody";
import { EpiPayload, ImagePayload } from "./types";
import { ApiProperty } from "@nestjs/swagger";

export class IntegrationImage extends IntegrationBody<
  ImagePayload,
  ProductImage
> {
  @ApiProperty({ type: ImagePayload })
  declare payload: ImagePayload;

  constructor(data?: Partial<IntegrationImage>) {
    super(ProductImage.name, data);
  }
  override transform(): ProductImage {
    const leaflet = new ProductImage();
    leaflet.productCode = this.payload.productCode;
    leaflet.content = this.payload.imageData;
    return leaflet;
  }
  override revert(product: ProductImage): ImagePayload {
    const payload = new ImagePayload();
    payload.productCode = product.productCode;
    payload.imageData = product.content;
    return payload;
  }
}
