import {
  Leaflet,
  LeafletFile,
  LeafletType,
} from "@bagacito/lavajet-toolkit";
import { IntegrationBody } from "./IntegrationBody";
import { EpiPayload, FileContent, ProductPayload } from "./types";
import { ApiProperty } from "@decaf-ts/for-nest";

export class IntegrationEpi extends IntegrationBody<
  EpiPayload,
  Leaflet,
  LeafletType
> {
  @ApiProperty({ type: EpiPayload })
  declare payload: EpiPayload;
  constructor(data?: Partial<IntegrationEpi>) {
    super(Leaflet.name, data);
  }
  override transform(epiType: LeafletType): Leaflet {
    const leaflet = new Leaflet();
    leaflet.lang = this.payload.language;
    leaflet.productCode = this.payload.productCode;
    leaflet.batchNumber = this.payload.batchNumber;
    leaflet.leafletType = epiType;
    if (this.payload.epiMarket) leaflet.epiMarket = this.payload.epiMarket;
    if (typeof this.payload.xmlFileContent === "string") {
      leaflet.xmlFileContent = this.payload.xmlFileContent;
    } else {
      leaflet.xmlFileContent = new LeafletFile({
        fileName: this.payload.xmlFileContent.filename,
        fileContent: this.payload.xmlFileContent.fileContent,
      });
    }
    if (this.payload.otherFilesContent) {
      leaflet.otherFilesContent = this.payload.otherFilesContent.map((file) => {
        return new LeafletFile({
          fileName: file.filename,
          fileContent: file.fileContent,
        });
      });
    }
    return leaflet;
  }
  override revert(product: Leaflet): EpiPayload {
    const payload = new EpiPayload();
    payload.language = product.lang;
    payload.productCode = product.productCode;
    if (product.batchNumber) payload.batchNumber = product.batchNumber;
    payload.epiMarket = product.epiMarket;
    if (product.xmlFileContent instanceof LeafletFile) {
      payload.xmlFileContent = product.xmlFileContent.fileContent;
    } else {
      payload.xmlFileContent = product.xmlFileContent;
    }
    payload.otherFilesContent = product.otherFilesContent.map((file) => {
      return {
        filename: file.fileName,
        fileContent: file.fileContent,
      } as FileContent;
    });

    return payload;
  }
}
