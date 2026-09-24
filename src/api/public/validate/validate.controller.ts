import { NotFoundError, OperationKeys } from "@decaf-ts/db-decorators";
import { Controller, Get, Ip, Param, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Token, TokenService } from "@bagacito/lavajet-toolkit";

import { Throttle } from "@nestjs/throttler";
import { Service } from "@decaf-ts/for-nest";
import { normalizeNameFromMSP } from "@bagacito/lavajet-toolkit/admin";
import { type Request } from "express";
import { Environment } from "../../../utils/environment";
import { logPublicFallbackEvent } from "../logUtils";

@ApiTags("validation public api")
@Controller("validate")
export class ValidateController {
  constructor(@Service(Token) protected readonly service: TokenService) {}

  protected logCtx(
    args: any[],
    operation: string | ((...args: any[]) => any),
    allowCreate: boolean = false
  ) {
    return this.service["logCtx"](args, operation, allowCreate as any);
  }

  @Get("token/:token")
  @Throttle({
    default: {
      ttl: Environment.throttling.publicTtlMs,
      limit: Environment.throttling.publicLimit,
    },
  })
  @ApiOperation({ summary: "Retrieve token information" })
  async validateToken(
    @Param("token") token: string,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    const { ctxArgs, ctx, log } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.validateToken);
    try {
      const tokenData = await this.service.read(token, ctx);
      const orgName = normalizeNameFromMSP(tokenData.mspid);
      console.log(`proccess ${process.env.ORG_DOMAIN} env vars ${process.env}`);
      const orgDomain = process.env.ORG_DOMAIN || "lavajet.internal";
      try {
        await this.service.validate(token, ctxArgs);
      } catch (e: unknown) {
        if (e instanceof NotFoundError) {
          logPublicFallbackEvent(req.url, false, ip, log);
          throw e;
        }
      }

      return {
        backendEndpoint: `ew-backend-${orgName}.${orgDomain}`,
        endpoint: `ew-cache-${orgName}.${orgDomain}`,
        orgName: orgName,
        mspId: tokenData.mspid,
      };
    } catch (e: unknown) {
      if (e instanceof NotFoundError)
        logPublicFallbackEvent(req.url, false, ip, log);
      throw e;
    }
  }
}
