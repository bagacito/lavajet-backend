import { LoggedClass } from "@decaf-ts/logging";
import {
  All,
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { type Request, type Response } from "express";
import { FabricKeycloakAuthHandler } from "../auth";
import { KibanaProxyService } from "./kibana-middleware";
import { KibanaSessionGuard } from "./kibana-session.guard";

@ApiTags("Kibana proxy")
@Controller({ path: "kibana", version: VERSION_NEUTRAL })
@UseGuards(KibanaSessionGuard, FabricKeycloakAuthHandler as any)
export class KibanaController extends LoggedClass {
  constructor(private readonly proxyService: KibanaProxyService) {
    super();
  }

  // Frontend calls this once with Bearer token to establish the session cookie.
  // KibanaSessionGuard sets the cookie; FabricKeycloakAuthHandler validates the token
  // and puts roles into DecafRequestContext as usual.
  @Get("auth")
  auth(@Res() res: Response) {
    this.log.for(this.auth).debug(`responding to auth`);
    res.sendStatus(204);
  }

  @All("*path")
  @SkipThrottle()
  async proxy(@Req() req: Request, @Res() res: Response) {
    this.log.for(this.proxy).debug(`proxying request ${req.url} to kibana`);
    req.url = req.url.replace(/^\/v\d+(?=\/)/, "").replace(/^\/kibana/, "");
    return this.proxyService.handle(req, res);
  }
}
