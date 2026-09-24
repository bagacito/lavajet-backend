import { Batch, ManufacturerAddress } from "@bagacito/lavajet-toolkit";
import { IntegrationBody } from "./IntegrationBody";
import { BatchPayload } from "./types";
import { ApiProperty } from "@nestjs/swagger";

export class IntegrationBatch extends IntegrationBody<BatchPayload, Batch> {
  @ApiProperty({ type: BatchPayload })
  declare payload: BatchPayload;

  constructor(data?: Partial<IntegrationBatch>) {
    super(Batch.name, data);
  }

  override transform(): Batch {
    const batch = new Batch();
    batch.productCode = this.payload.productCode;
    batch.batchNumber = this.payload.batchNumber;
    batch.expiryDate = new Date(this.payload.expiryDate);
    batch.batchRecall = this.payload.batchRecall;

    if (this.payload.importLicenseNumber) {
      batch.importLicenseNumber = this.payload.importLicenseNumber;
    }
    if (this.payload.dateOfManufacturing) {
      batch.dateOfManufacturing = new Date(this.payload.dateOfManufacturing);
    }
    if (this.payload.manufacturerName) {
      batch.manufacturerName = this.payload.manufacturerName;
    }

    const addresses = [
      this.payload.manufacturerAddress1,
      this.payload.manufacturerAddress2,
      this.payload.manufacturerAddress3,
      this.payload.manufacturerAddress4,
      this.payload.manufacturerAddress5,
    ].filter((address): address is string => Boolean(address));

    if (addresses.length > 0) {
      batch.manufacturerAddress = addresses.map((address) => {
        return new ManufacturerAddress({ address });
      });
    }

    if (this.payload.packagingSiteName) {
      batch.packagingSiteName = this.payload.packagingSiteName;
    }
    return batch;
  }

  override revert(batch: Batch): BatchPayload {
    const payload = new BatchPayload();
    payload.productCode = batch.productCode;
    payload.batchNumber = batch.batchNumber;
    payload.expiryDate = this.serializeDate(batch.expiryDate);
    payload.batchRecall = batch.batchRecall;
    if (batch.importLicenseNumber)
      payload.importLicenseNumber = batch.importLicenseNumber;
    if (batch.dateOfManufacturing)
      payload.dateOfManufacturing = this.serializeDate(
        batch.dateOfManufacturing
      );
    if (batch.manufacturerName)
      payload.manufacturerName = batch.manufacturerName;
    if (batch.packagingSiteName)
      payload.packagingSiteName = batch.packagingSiteName;

    const addresses = (batch.manufacturerAddress ?? []).map(
      (address) => address.address
    );
    payload.manufacturerAddress1 = addresses[0];
    payload.manufacturerAddress2 = addresses[1];
    payload.manufacturerAddress3 = addresses[2];
    payload.manufacturerAddress4 = addresses[3];
    payload.manufacturerAddress5 = addresses[4];

    return payload;
  }

  private serializeDate(date?: Date): string {
    if (!date) return "";
    return date.toISOString();
  }
}
