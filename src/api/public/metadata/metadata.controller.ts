import { NotFoundError, OperationKeys } from "@decaf-ts/db-decorators";
import { Controller, Get, Ip, Param, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Service } from "@decaf-ts/for-nest";
import {
  Batch,
  BatchService,
  Leaflet,
  LeafletService,
} from "@bagacito/lavajet-toolkit";
import { type Request } from "express";
import { Environment } from "../../../utils/environment";
import { logPublicFallbackEvent } from "../logUtils";

@ApiTags("metadata public api")
@Throttle({
  default: {
    ttl: Environment.throttling.publicTtlMs,
    limit: Environment.throttling.publicLimit,
  },
})
@Controller("metadata")
export class MetadataController {
  constructor(
    @Service(Leaflet) protected readonly service: LeafletService,
    @Service(Batch) protected readonly batchService: BatchService
  ) {}

  protected logCtx(
    args: any[],
    operation: string | ((...args: any[]) => any),
    allowCreate: boolean = false
  ) {
    return this.service["logCtx"](args, operation, allowCreate as any);
  }

  @Get(":productCode/:batchNumber")
  @ApiOperation({ summary: "Retrieve metadata for product and Batch" })
  async read(
    @Param("productCode") productCode: string,
    @Param("batchNumber") batchNumber: string,
    @Query("serial") serial: string,
    @Query("expiry") expiry: string,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    const { ctxArgs, log } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.read);

    const batch = await this.batchService.findBy(
      "batchNumber",
      batchNumber,
      ...ctxArgs
    );
    if (batch.length === 0) {
      log.warn(
        `SUSPICIOUS - BATCH NOT FOUND, product: ${productCode}, batch: ${batchNumber}, client : ${ip}`
      );
      if (Environment.scans.allowMissingBatch) {
        logPublicFallbackEvent(req.url, false, ip, log);
        throw new NotFoundError("Batch not found");
      }
    }
    try {
      const metadata = await this.service.metadataPublicFallback(
        productCode,
        batch.length === 0 ? undefined : batchNumber,
        ...ctxArgs
      );
      return metadata;
    } catch (e: unknown) {
      if (e instanceof NotFoundError)
        logPublicFallbackEvent(req.url, false, ip, log);
      throw e;
    }
  }

  @Get(":productCode")
  @ApiOperation({ summary: "Retrieve metadata for product" })
  async readOnlyProduct(
    @Param("productCode") productCode: string,
    @Query("serial") serial: string,
    @Query("expiry") expiry: string,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    const { ctxArgs, log } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.read);
    try {
      return this.service.metadataPublicFallback(
        productCode,
        undefined,
        ...ctxArgs
      );
    } catch (e: unknown) {
      if (e instanceof NotFoundError)
        logPublicFallbackEvent(req.url, false, ip, log);
      throw e;
    }
  }
}
