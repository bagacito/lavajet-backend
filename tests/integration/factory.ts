import { Batch, Product } from "@bagacito/lavajet-toolkit";
import { generateGtin, getBatch } from "./gtin-generator";

export class Factory {
  // static getToken(
  //   email: string,
  //   roles: string[] = ["epi:admin", "epi:writer", "epi:reader"]
  // ) {
  //   const payload: KeyCloakDecodedToken = {};
  // }

  static getProduct() {
    return new Product({
      productCode: generateGtin(),
      inventedName: "Test Product",
      nameMedicinalProduct: "Test Medicinal Product",
    });
  }

  static getProductPayload() {
    return {
      productCode: generateGtin(),
      inventedName: "Test Product",
      nameMedicinalProduct: "Test Medicinal Product",
    };
  }

  static getBatch(gtin: string) {
    return new Batch({
      productCode: gtin,
      batchNumber: getBatch(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
  }
}
