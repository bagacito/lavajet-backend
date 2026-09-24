import { NotFoundError, OperationKeys } from "@decaf-ts/db-decorators";
import { Controller, Get, Ip, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  GtinOwner,
  Product,
  ProductService,
} from "@bagacito/lavajet-toolkit";

import { Throttle } from "@nestjs/throttler";
import { ApiOperationFromModel, Service } from "@decaf-ts/for-nest";
import { type Request } from "express";
import { logPublicFallbackEvent } from "../logUtils";
import { Environment } from "../../../utils/environment";
import { Repo } from "@decaf-ts/core";
import { Repository } from "@decaf-ts/for-nest";

@ApiTags("owner public api")
@Throttle({
  default: {
    ttl: Environment.throttling.publicTtlMs,
    limit: Environment.throttling.publicLimit,
  },
})
@Controller("owner")
export class OwnerController {
  constructor(
    @Service(Product) protected readonly service: ProductService,
    @Repository(GtinOwner) protected repo: Repo<GtinOwner>
  ) {}

  protected logCtx(
    args: any[],
    operation: string | ((...args: any[]) => any),
    allowCreate: boolean = false
  ) {
    return this.service["logCtx"](args, operation, allowCreate as any);
  }

  @Get(":productCode")
  @ApiOperation({ summary: "Retrieve the owner of the product" })
  async owner(
    @Param("productCode") productCode: string,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    const { ctxArgs, log } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.owner);
    try {
      return this.service.ownerPublicFallback(productCode, ...ctxArgs);
    } catch (e: unknown) {
      if (e instanceof NotFoundError)
        logPublicFallbackEvent(req.url, false, ip, log);
      throw e;
    }
  }

  @Get(":productCodeOrName")
  @ApiOperation({ summary: `Retrieve gtin owner records.` })
  @ApiOkResponse({ description: `gtin owners retrieved successfully.` })
  async page(
    @Param("productCodeOrName") productCodeOrName: string,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    const { ctxArgs, log, ctx } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.page);

    const empty = { current: 0, total: 0, count: 0, data: [] };

    if (productCodeOrName.length < 3) return empty;
    try {
      return await this.repo.page(productCodeOrName, ctx);
    } catch (e: unknown) {
      if (e instanceof NotFoundError) return empty;
      throw e;
    }
  }
}
