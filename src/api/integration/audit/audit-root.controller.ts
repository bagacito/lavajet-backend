import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UnsupportedError } from "@decaf-ts/core";
import {
  Auth,
  DecafModelController,
  DecafRequestContext,
} from "@decaf-ts/for-nest";
import { OperationKeys } from "@decaf-ts/db-decorators";
import { ModelConstructor } from "@decaf-ts/decorator-validation";
import { Audit } from "@bagacito/lavajet-toolkit";
import { DeprecatedInterceptor } from "../../../interceptors";

@UseInterceptors(DeprecatedInterceptor)
@ApiTags("/audit")
@Controller()
@Auth(Audit)
export class LegacyAuditRootController extends DecafModelController<Audit> {
  pk: keyof Audit = "id" as const;

  override get class(): ModelConstructor<Audit> {
    return Audit;
  }

  constructor(clientContext: DecafRequestContext) {
    super(clientContext, "AuditRootLegacyController");
  }

  @Get(":logType")
  @ApiOperation({
    summary: "List audit logs",
    deprecated: true,
  })
  async getAudit(
    @Param("logType") logType: string,
    @Query("query") query: string,
    @Query("filter") filter: string,
    @Query("start") start: number,
    @Query("sort") sort: string,
    @Query("number") number: number
  ) {
    await (await this.logCtx([], OperationKeys.READ, true)).for(this.getAudit);
    throw new UnsupportedError("Not implemented");
  }

  @Post(":logType")
  @ApiOperation({
    summary: "Add audit log",
    deprecated: true,
  })
  async postAudit(@Param("logType") logType: string, @Body() body: any) {
    await (await this.logCtx([], OperationKeys.READ, true)).for(this.postAudit);
    throw new UnsupportedError("Not implemented");
  }
}
