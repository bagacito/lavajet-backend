/**
 * @module ew-backend/api/integration/audit
 * @description This module defines the audit controller for the integration API.
 * @summary It provides endpoints for retrieving and submitting audit logs.
 * @category API
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { DeprecatedInterceptor } from "../../../interceptors";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  Auth,
  DecafModelController,
  DecafRequestContext,
} from "@decaf-ts/for-nest";
import { OperationKeys } from "@decaf-ts/db-decorators";
import { ModelConstructor } from "@decaf-ts/decorator-validation";
import { Audit } from "@bagacito/lavajet-toolkit";
import { UnsupportedError } from "@decaf-ts/core";

// TODO I think we can remove this entire controller along with its routes as they are not used anymore

@UseInterceptors(DeprecatedInterceptor)
@ApiTags("/integration Audit")
@Controller("audit")
@Auth(Audit)
export class IntegrationAuditController extends DecafModelController<Audit> {
  pk: keyof Audit = "id" as const;

  override get class(): ModelConstructor<Audit> {
    return Audit;
  }
  constructor(clientContext: DecafRequestContext) {
    super(clientContext, "AuditLegacyController");
  }
  /**
   * @method getAudit
   * @description Retrieves audit logs by type.
   * @param {string} logType - The type of log to retrieve.
   * @param {string} query - The query string.
   * @param {number} start - The starting index.
   * @param {string} sort - The sort order.
   * @param {number} number - The number of logs to retrieve.
   * @throws {Error} Not implemented.
   */
  @Get(":logType")
  @ApiOperation({
    summary:
      "Retrieve audit logs by type. This api is no longer used and shows only for historical reference",
    deprecated: true,
  })
  async getAudit(
    @Param("logType") logType: string,
    @Query("query") query: string,
    @Query("start") start: number,
    @Query("sort") sort: string,
    @Query("number") number: number
  ) {
    const { ctx, log, ctxArgs } = (
      await this.logCtx([], OperationKeys.READ, true)
    ).for(this.getAudit);
    throw new UnsupportedError("Not implemented");
  }

  /**
   * @method postAudit
   * @description Submits an audit record.
   * @param {string} logType - The type of log to submit.
   * @param {any} body - The audit record.
   * @throws {Error} Not implemented.
   */
  @Post(":logType")
  @ApiOperation({
    summary:
      "Submit an audit record. This api is no longer used and shows only for historical reference",
    deprecated: true,
  })
  async postAudit(@Param("logType") logType: string, @Body() body: any) {
    const { ctx, log, ctxArgs } = (
      await this.logCtx([], OperationKeys.READ, true)
    ).for(this.getAudit);
    throw new UnsupportedError("Not implemented");
  }
}
