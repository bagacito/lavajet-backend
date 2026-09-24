import {
  Condition,
  Context,
  ContextualizedArgs,
  MaybeContextualArg,
  MethodOrOperation,
} from "@decaf-ts/core";
import { NotFoundError, OperationKeys } from "@decaf-ts/db-decorators";
import {
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Req,
  Res,
  Body,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Leaflet, LeafletService } from "@bagacito/lavajet-toolkit";
import { type Request, type Response } from "express";
import { logPublicFallbackEvent } from "../logUtils";
import { Environment } from "../../../utils/environment";
import { Auth, DecafRequestContext, Service } from "@decaf-ts/for-nest";

@ApiTags("leaflet public api")
@Throttle({
  default: {
    ttl: Environment.throttling.publicTtlMs,
    limit: Environment.throttling.publicLimit,
  },
})
@Controller("leaflet")
export class LeafletController {
  constructor(
    @Service(Leaflet) protected readonly service: LeafletService,
    protected readonly clientContext: DecafRequestContext
  ) {}

  protected logCtx<
    CONTEXT extends Context<any> = any,
    ARGS extends any[] = any[],
    METHOD extends MethodOrOperation = MethodOrOperation,
  >(
    args: MaybeContextualArg<CONTEXT, ARGS>,
    operation: METHOD,
    allowCreate: true
  ): Promise<
    ContextualizedArgs<CONTEXT, ARGS, METHOD extends string ? true : false>
  > {
    return this.service["logCtx"](args, operation, allowCreate as any) as any;
  }

  @Get()
  @ApiOperation({ summary: "Retrieve a leaflet" })
  @ApiQuery({
    name: "gtin",
    required: true,
    type: String,
    description: "Product code of the leaflet",
  })
  @ApiQuery({
    name: "batchNumber",
    required: false,
    type: String,
    description: "Batch of the leaflet",
  })
  @ApiQuery({
    name: "type",
    required: true,
    type: String,
    description: "EPI type of the leaflet.",
  })
  @ApiQuery({
    name: "lang",
    required: true,
    type: String,
    description: "Language code of the leaflet.",
  })
  @ApiQuery({
    name: "market",
    required: true,
    type: String,
    description: "Market of the leaflet.",
  })
  async fallbackRead(
    @Query("gtin") gtin: string,
    @Query("batch") batchNumber: string,
    @Query("type") type: string,
    @Query("lang") lang: string,
    @Query("market") market: string,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    const { ctxArgs, log } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.fallbackRead);
    try {
      return this.service.leafletPublicFallback(
        gtin,
        batchNumber,
        type,
        lang,
        market,
        ...ctxArgs
      );
    } catch (e: unknown) {
      if (e instanceof NotFoundError)
        logPublicFallbackEvent(req.url, false, ip, log);
      throw e;
    }
  }

  /**
   * Maps an optional leaflet coordinate carried as a path segment.
   *
   * `batch`, `epiType` and `market` are all optional on a leaflet, so a fixed
   * arity route has to carry a sentinel for the missing ones. `default` is the
   * sentinel (the same one the PLA tree uses for market-less leaflets); empty
   * and literal `undefined`/`null` segments are tolerated so a client that
   * interpolates a missing value still resolves.
   */
  protected optionalSegment(value?: string): string | undefined {
    const segment = (value ?? "").trim();
    if (!segment) return undefined;
    if (["default", "undefined", "null", "-"].includes(segment.toLowerCase()))
      return undefined;
    return segment;
  }

  /**
   * Relaxes the helmet defaults that forbid cross-origin framing, for this
   * response only.
   *
   * The document is rendered in an iframe served from the frontend origin
   * (ew-frontend-*.<domain>) while the bytes come from the backend origin
   * (ew-backend-*.<domain>). With `X-Frame-Options: SAMEORIGIN`,
   * `frame-ancestors 'self'` and `Cross-Origin-Resource-Policy: same-origin`
   * the browser fetches the document fine (200) but refuses to display it, so
   * the preview shows an empty frame. Same approach as KibanaCspMiddleware.
   */
  protected allowCrossOriginFraming(res: Response) {
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Cross-Origin-Opener-Policy");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    const csp = res.getHeader("content-security-policy");
    if (csp) {
      const strip = (value: string) =>
        value.replace(/frame-ancestors[^;]*(;|$)/g, "").trim();
      res.setHeader(
        "content-security-policy",
        Array.isArray(csp)
          ? csp.map((v) => strip(String(v)))
          : strip(String(csp))
      );
    }
  }

  /**
   * Shared implementation of the external document content routes.
   */
  protected async streamExternalDocument(
    gtin: string,
    batch: string | undefined,
    epiType: string | undefined,
    market: string | undefined,
    lang: string,
    fileName: string,
    res: Response,
    ip: string,
    req: Request
  ) {
    const { ctxArgs, log } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.streamExternalDocument);
    try {
      const result = await this.service.externalDocumentContent(
        gtin,
        this.optionalSegment(batch),
        epiType as string,
        lang,
        this.optionalSegment(market),
        fileName,
        ...ctxArgs
      );
      const contentType = result.contentType || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${fileName.replace(/["\\]/g, "")}"`
      );
      this.allowCrossOriginFraming(res);
      for await (const chunk of result.stream) {
        res.write(chunk);
      }
      res.end();
      return;
    } catch (e: unknown) {
      if (e instanceof NotFoundError) {
        logPublicFallbackEvent(req.url, false, ip, log);
        res.status(404).json({
          statusCode: 404,
          message: (e as Error).message,
        });
        return;
      }
      throw e;
    }
  }

  @Get("external/:gtin/:batch/:epiType/:market/:lang/:fileName")
  @ApiOperation({
    summary:
      "Stream an external document of a leaflet (validated against the leaflet context)",
  })
  @ApiParam({
    name: "gtin",
    required: true,
    description: "Product code (GTIN).",
  })
  @ApiParam({
    name: "batch",
    required: true,
    description: "Batch number, or 'default' when the leaflet has no batch.",
  })
  @ApiParam({
    name: "epiType",
    required: true,
    description: "EPI type / leaflet type of the leaflet.",
  })
  @ApiParam({
    name: "market",
    required: true,
    description: "Market of the leaflet, or 'default' when it has no market.",
  })
  @ApiParam({ name: "lang", required: true, description: "Language code." })
  @ApiParam({
    name: "fileName",
    required: true,
    description: "Original external document file name (no path).",
  })
  async externalDocumentContent(
    @Param("gtin") gtin: string,
    @Param("batch") batch: string,
    @Param("epiType") epiType: string,
    @Param("market") market: string,
    @Param("lang") lang: string,
    @Param("fileName") fileName: string,
    @Res() res: Response,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    return this.streamExternalDocument(
      gtin,
      batch,
      epiType,
      market,
      lang,
      fileName,
      res,
      ip,
      req
    );
  }

  @Get("external/:gtin/:epiType/:market/:lang/:fileName")
  @ApiOperation({
    summary:
      "Stream an external document of a batch-less leaflet (fallback without the batch segment)",
  })
  @ApiParam({
    name: "gtin",
    required: true,
    description: "Product code (GTIN).",
  })
  @ApiParam({
    name: "epiType",
    required: true,
    description: "EPI type / leaflet type of the leaflet.",
  })
  @ApiParam({
    name: "market",
    required: true,
    description: "Market of the leaflet, or 'default' when it has no market.",
  })
  @ApiParam({ name: "lang", required: true, description: "Language code." })
  @ApiParam({
    name: "fileName",
    required: true,
    description: "Original external document file name (no path).",
  })
  async externalDocumentContentNoBatch(
    @Param("gtin") gtin: string,
    @Param("epiType") epiType: string,
    @Param("market") market: string,
    @Param("lang") lang: string,
    @Param("fileName") fileName: string,
    @Res() res: Response,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    return this.streamExternalDocument(
      gtin,
      undefined,
      epiType,
      market,
      lang,
      fileName,
      res,
      ip,
      req
    );
  }

  /**
   * Shared implementation of the external document upload routes.
   *
   * The upload NEVER writes to the ledger: it stores the bytes and returns the
   * resulting `ExternalFile` reference. The reference is then persisted by the
   * normal Leaflet create/update API, which is the single write path for a
   * leaflet (and the only one that works while the leaflet is still being
   * created in the form).
   */
  protected async uploadExternalDocumentPayload(
    gtin: string,
    batch: string | undefined,
    epiType: string | undefined,
    market: string | undefined,
    lang: string,
    body: {
      fileName: string;
      contentType?:
        | "video/mp4"
        | "image/png"
        | "image/jpeg"
        | "application/pdf";
      size: number;
      dataBase64: string;
    }
  ) {
    const { ctxArgs } = (
      (await this.logCtx([], OperationKeys.CREATE, true)) as any
    ).for(this.uploadExternalDocumentPayload);
    const data = Buffer.from(body.dataBase64, "base64");
    const overrides = this.clientContext.toOverrides();
    return this.service.for(overrides).uploadExternalDocument(
      gtin,
      this.optionalSegment(batch),
      this.optionalSegment(epiType),
      lang,
      this.optionalSegment(market),
      {
        fileName: body.fileName,
        contentType: body.contentType as any,
        size: body.size,
        data,
      },
      ...ctxArgs
    );
  }

  @Post("external/:gtin/:batch/:epiType/:market/:lang")
  @Auth(Leaflet)
  @ApiOperation({
    summary:
      "Upload an external document for a leaflet context (stored in S3, returns the reference to persist through the Leaflet API)",
  })
  @ApiParam({
    name: "gtin",
    required: true,
    description: "Product code (GTIN).",
  })
  @ApiParam({
    name: "batch",
    required: true,
    description: "Batch number, or 'default' when the leaflet has no batch.",
  })
  @ApiParam({
    name: "epiType",
    required: true,
    description: "EPI type / leaflet type of the leaflet.",
  })
  @ApiParam({
    name: "market",
    required: true,
    description: "Market of the leaflet, or 'default' when it has no market.",
  })
  @ApiParam({ name: "lang", required: true, description: "Language code." })
  async uploadExternalDocument(
    @Param("gtin") gtin: string,
    @Param("batch") batch: string,
    @Param("epiType") epiType: string,
    @Param("market") market: string,
    @Param("lang") lang: string,
    @Body()
    body: {
      fileName: string;
      contentType?:
        | "video/mp4"
        | "image/png"
        | "image/jpeg"
        | "application/pdf";
      size: number;
      dataBase64: string;
    }
  ) {
    return this.uploadExternalDocumentPayload(
      gtin,
      batch,
      epiType,
      market,
      lang,
      body
    );
  }

  @Post("external/:gtin/:epiType/:market/:lang")
  @Auth(Leaflet)
  @ApiOperation({
    summary:
      "Upload an external document for a batch-less leaflet (fallback without the batch segment)",
  })
  @ApiParam({
    name: "gtin",
    required: true,
    description: "Product code (GTIN).",
  })
  @ApiParam({
    name: "epiType",
    required: true,
    description: "EPI type / leaflet type of the leaflet.",
  })
  @ApiParam({
    name: "market",
    required: true,
    description: "Market of the leaflet, or 'default' when it has no market.",
  })
  @ApiParam({ name: "lang", required: true, description: "Language code." })
  async uploadExternalDocumentNoBatch(
    @Param("gtin") gtin: string,
    @Param("epiType") epiType: string,
    @Param("market") market: string,
    @Param("lang") lang: string,
    @Body()
    body: {
      fileName: string;
      contentType?:
        | "video/mp4"
        | "image/png"
        | "image/jpeg"
        | "application/pdf";
      size: number;
      dataBase64: string;
    }
  ) {
    return this.uploadExternalDocumentPayload(
      gtin,
      undefined,
      epiType,
      market,
      lang,
      body
    );
  }

  // The leaflet-mutating external document routes are intentionally NOT
  // exposed. A leaflet is only ever written through the Leaflet API
  // (create/update), which persists the whole `externalFiles` list, so an
  // attach/detach route would be a second, competing write path:
  //
  //   - attach:  POST above uploads the bytes and returns the reference; the
  //              reference is persisted by the Leaflet create/update.
  //   - detach:  the UI drops the reference from the list and updates the
  //              leaflet; neither ew-frontend nor lwa ever called DELETE.
  //
  // `LeafletService.addExternalDocument` / `removeExternalDocument` remain
  // available for programmatic/back-office use.
  //
  // @Delete("external/:gtin/:batch/:epiType/:market/:lang/:fileName")
  // @Auth(Leaflet)
  // @ApiOperation({
  //   summary:
  //     "Remove an external document from a leaflet and delete it from S3 (audit trailed)",
  // })
  // async removeExternalDocument(
  //   @Param("gtin") gtin: string,
  //   @Param("batch") batch: string,
  //   @Param("epiType") epiType: string,
  //   @Param("market") market: string,
  //   @Param("lang") lang: string,
  //   @Param("fileName") fileName: string
  // ) {
  //   const { ctxArgs } = (
  //     (await this.logCtx([], OperationKeys.UPDATE, true)) as any
  //   ).for(this.removeExternalDocument);
  //   const overrides = this.clientContext.toOverrides();
  //   const leaflet = await this.service
  //     .for(overrides)
  //     .removeExternalDocument(
  //       gtin,
  //       this.optionalSegment(batch),
  //       epiType,
  //       lang,
  //       this.optionalSegment(market),
  //       fileName,
  //       ...ctxArgs
  //     );
  //   return leaflet.toCache(false);
  // }

  // @Get(":productCode/:batchNumber/:leafletType/:lang/:epiType")
  // @ApiOperation({ summary: "Retrieve a leaflet" })
  // @ApiParam({
  //   name: "epiType",
  //   required: true,
  //   description: "Language code or market of the leaflet.",
  // })
  // @ApiParam({
  //   name: "lang",
  //   required: true,
  //   description: "Language code or market of the leaflet.",
  // })
  // @ApiParam({
  //   name: "leafletType",
  //   required: true,
  //   description:
  //     "Language code or leaflet type of the product associated with this leaflet.",
  // })
  // @ApiParam({
  //   name: "batchNumber",
  //   required: true,
  //   description:
  //     "Batch number or leaflet type of the product associated with this leaflet.",
  // })
  // @ApiParam({
  //   name: "productCode",
  //   required: true,
  //   description: "GTIN code of the product associated with this leaflet.",
  // })
  // async read(
  //   @Param("productCode") productCode: string,
  //   @Param("batchNumber") batchNumber: string | undefined,
  //   @Param("leafletType") leafletType: string,
  //   @Param("lang") lang: string,
  //   @Param("epiType") epiType: string,
  //   @Ip() ip: string,
  //   @Req() req: Request
  // ) {
  //   const { ctxArgs, log } = (
  //     (await this.logCtx([], OperationKeys.READ, true)) as any
  //   ).for(this.read);
  //   try {
  //     return this.service.leafletPublicFallback(
  //       productCode,
  //       batchNumber,
  //       leafletType,
  //       lang,
  //       epiType,
  //       ...ctxArgs
  //     );
  //   } catch (e: unknown) {
  //     if (e instanceof NotFoundError)
  //       logPublicFallbackEvent(req.url, false, ip, log);
  //     throw e;
  //   }
  // }

  // @Get(":productCode/:leafletType/:lang/:epiType")
  // @ApiOperation({ summary: "Retrieve a leaflet" })
  // @ApiParam({
  //   name: "epiType",
  //   required: true,
  //   description: "Language code or market of the leaflet.",
  // })
  // @ApiParam({
  //   name: "lang",
  //   required: true,
  //   description: "Language code or market of the leaflet.",
  // })
  // @ApiParam({
  //   name: "leafletType",
  //   required: true,
  //   description:
  //     "Language code or leaflet type of the product associated with this leaflet.",
  // })
  // @ApiParam({
  //   name: "batchNumber",
  //   required: true,
  //   description:
  //     "Batch number or leaflet type of the product associated with this leaflet.",
  // })
  // @ApiParam({
  //   name: "productCode",
  //   required: true,
  //   description: "GTIN code of the product associated with this leaflet.",
  // })
  // async read2(
  //   @Param("productCode") productCode: string,
  //   @Param("leafletType") leafletType: string,
  //   @Param("lang") lang: string,
  //   @Param("epiType") epiType: string,
  //   @Ip() ip: string,
  //   @Req() req: Request
  // ) {
  //   const { ctxArgs, log } = (
  //     (await this.logCtx([], OperationKeys.READ, true)) as any
  //   ).for(this.read);
  //   try {
  //     return this.service.leafletPublicFallback(
  //       productCode,
  //       undefined,
  //       leafletType,
  //       lang,
  //       epiType,
  //       ...ctxArgs
  //     );
  //   } catch (e: unknown) {
  //     if (e instanceof NotFoundError)
  //       logPublicFallbackEvent(req.url, false, ip, log);
  //     throw e;
  //   }
  // }

  // @Get(":productCode/:leafletType/:lang")
  // @ApiOperation({ summary: "Retrieve a leaflet" })
  // @ApiParam({
  //   name: "lang",
  //   required: true,
  //   description: "Language code or market of the leaflet.",
  // })
  // @ApiParam({
  //   name: "leafletType",
  //   required: true,
  //   description:
  //     "Language code or leaflet type of the product associated with this leaflet.",
  // })
  // @ApiParam({
  //   name: "batchNumber",
  //   required: true,
  //   description:
  //     "Batch number or leaflet type of the product associated with this leaflet.",
  // })
  // @ApiParam({
  //   name: "productCode",
  //   required: true,
  //   description: "GTIN code of the product associated with this leaflet.",
  // })
  // async read3(
  //   @Param("productCode") productCode: string,
  //   @Param("leafletType") leafletType: string,
  //   @Param("lang") lang: string,
  //   @Ip() ip: string,
  //   @Req() req: Request
  // ) {
  //   const { ctxArgs, log } = (
  //     (await this.logCtx([], OperationKeys.READ, true)) as any
  //   ).for(this.read);
  //   try {
  //     return this.service.leafletPublicFallback(
  //       productCode,
  //       undefined,
  //       leafletType,
  //       lang,
  //       undefined,
  //       ...ctxArgs
  //     );
  //   } catch (e: unknown) {
  //     if (e instanceof NotFoundError)
  //       logPublicFallbackEvent(req.url, false, ip, log);
  //     throw e;
  //   }
  // }

  @Get("page/:productCode")
  @ApiOperation({ summary: `Retrieve leaflets records.` })
  @ApiOkResponse({ description: `leaflets retrieved successfully.` })
  async page(
    @Param("productCode") productCode: string,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    const { ctxArgs, log, ctx } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.page);

    const empty = { current: 0, total: 0, count: 0, data: [] };

    try {
      return await this.service
        .select()
        .where(Condition.attr<Leaflet>("productCode").eq(productCode))
        .paginate(ctx);
    } catch (e: unknown) {
      if (e instanceof NotFoundError) return empty;
      throw e;
    }
  }
}
