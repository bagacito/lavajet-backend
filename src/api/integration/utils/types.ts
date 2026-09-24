import { LeafletType } from "@bagacito/lavajet-toolkit";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class Strength {
  @ApiProperty()
  substance!: string;
  @ApiProperty()
  strength!: string;
}

export class Market {
  @ApiProperty()
  marketId!: string;
  @ApiPropertyOptional()
  nationalCode!: string;
  @ApiPropertyOptional()
  mahAddress!: string;
  @ApiPropertyOptional()
  mahName!: string;
  @ApiPropertyOptional()
  legalEntityName!: string;
}

export class ProductPayload {
  @ApiProperty()
  productCode!: string;
  @ApiProperty()
  inventedName!: string;
  @ApiProperty()
  nameMedicinalProduct!: string;
  @ApiProperty()
  internalMaterialCode!: string;
  @ApiProperty()
  productRecall!: boolean;
  @ApiPropertyOptional({ type: [Strength] })
  strengths?: Strength[];
  @ApiPropertyOptional({ type: [Market] })
  markets?: Market[];
  @ApiPropertyOptional()
  version?: number;
}

export class FileContent {
  @ApiProperty()
  filename!: string;
  @ApiProperty()
  fileContent!: string;
}

export class EpiPayload {
  @ApiProperty()
  language!: string;
  @ApiProperty()
  productCode!: string;
  @ApiPropertyOptional()
  batchNumber?: string;
  @ApiPropertyOptional()
  epiMarket?: string;
  @ApiProperty({
    oneOf: [{ type: "string" }, { $ref: "#/components/schemas/FileContent" }],
  })
  xmlFileContent!: string | FileContent;
  @ApiPropertyOptional({
    oneOf: [
      { type: "array", items: { type: "string" } },
      {
        type: "array",
        items: { $ref: "#/components/schemas/FileContent" },
      },
    ],
  })
  otherFilesContent?: string[] | FileContent[];
}

export class ImagePayload {
  @ApiProperty()
  productCode!: string;
  @ApiProperty({
    description: "Base64 image data (or data URL)",
  })
  imageData!: string;
}
export class BatchPayload {
  @ApiProperty()
  productCode!: string;
  @ApiProperty()
  batchNumber!: string;
  @ApiProperty({
    description: "ISO date string",
    example: "2028-12-31T00:00:00.000Z",
  })
  expiryDate!: string;
  @ApiProperty()
  batchRecall!: boolean;
  @ApiPropertyOptional()
  importLicenseNumber?: string;
  @ApiPropertyOptional({
    description: "ISO date string",
    example: "2026-04-01T00:00:00.000Z",
  })
  dateOfManufacturing?: string;
  @ApiPropertyOptional()
  manufacturerName?: string;
  @ApiPropertyOptional()
  manufacturerAddress1?: string;
  @ApiPropertyOptional()
  manufacturerAddress2?: string;
  @ApiPropertyOptional()
  manufacturerAddress3?: string;
  @ApiPropertyOptional()
  manufacturerAddress4?: string;
  @ApiPropertyOptional()
  manufacturerAddress5?: string;
  @ApiPropertyOptional()
  packagingSiteName?: string;
}
