import {
    ContextOf,
    MaybeContextualArg,
    OrderDirection,
    Repository,
    type SerializedPage,
} from "@decaf-ts/core";
import { NotFoundError, OperationKeys } from "@decaf-ts/db-decorators";
import { Public, Service } from "@decaf-ts/for-nest";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
    GtinOwner,
    Leaflet,
    LeafletService,
    Product,
    ProductService,
} from "@bagacito/lavajet-toolkit";
import { Environment } from "../../../utils/environment";
import { getLoggerFor } from "../../../utils/logging";

// type PublicProductFindItem = {
//   productCode: string;
//   name: string;
//   batchNumber?: string;
// };

@ApiTags("product public api")
@Throttle({
  default: {
    ttl: Environment.throttling.publicTtlMs,
    limit: Environment.throttling.publicLimit,
  },
})
@Controller("product")
export class PublicProductController {
  constructor(
    @Service(Product) protected readonly service: ProductService,
    @Service(Leaflet) protected readonly leaflets: LeafletService
  ) {}

  protected logCtx(
    args: MaybeContextualArg<ContextOf<ProductService>, unknown[]>,
    operation: string | ((...args: unknown[]) => unknown),
    allowCreate: boolean = false
  ) {
    return this.service["logCtx"](args, operation, allowCreate as any);
  }

  @Get(":value")
  @Public()
  @ApiOperation({
    summary:
      "Search products by GTIN (or prefix) with client-driven pagination",
  })
  @ApiParam({
    name: "value",
    required: true,
    type: String,
    description: "Product Code (GTIN) or prefix",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    type: Number,
    description: "1-based page number. Defaults to 1.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Page size. Defaults to 10.",
  })
  @ApiQuery({
    name: "bookmark",
    required: false,
    type: String,
    description: "Opaque continuation token returned by the previous page.",
  })
  async fallbackRead(
    @Param("value") value: string,
    @Query("offset") offset: string = "1",
    @Query("limit") limit: string = "10",
    @Query("bookmark") bookmark?: string
  ): Promise<SerializedPage<GtinOwner>> {
    const { ctxArgs, ctx, log } = (
      (await this.logCtx([], OperationKeys.READ, true)) as any
    ).for(this.fallbackRead);

    const logger = getLoggerFor(log, ctx);
    logger.info(`Searching for: ${value}`);

    try {
      return await Repository.forModel(GtinOwner).page(
        value,
        OrderDirection.ASC,
        {
          offset: Math.max(1, Number(offset) || 1),
          limit: Math.min(100, Math.max(1, Number(limit) || 10)),
          bookmark: bookmark || undefined,
        },
        ...ctxArgs
      );
    } catch (e: unknown) {
      if (e instanceof NotFoundError)
        return { current: 1, total: 0, count: 0, data: [] };
      throw e;
    }

    // try {
    //   return await this.searchOwners(value, {
    //     offset: Math.max(1, Number(offset) || 1),
    //     limit: Math.min(100, Math.max(1, Number(limit) || 10)),
    //     bookmark: bookmark || undefined,
    //   });
    // } catch (e: unknown) {
    //   if (e instanceof NotFoundError) return [];
    //   throw e;

    // }

    // const items: PublicProductFindItem[] = [];
    // for (const owner of owners) {
    //   let meta;
    //   try {
    //     meta = await this.leaflets.metadataPublicFallback(
    //       owner.productCode,
    //       undefined,
    //       ...ctxArgs
    //     );
    //   } catch (e: unknown) {
    //     if (e instanceof NotFoundError) continue;
    //     throw e;
    //   }

    //   const hasProductLeaflet =
    //     Object.keys(meta.leaflet?.pla?.product ?? {}).length > 0;
    //   const hasBatchLeaflet =
    //     Object.keys(meta.leaflet?.pla?.batch ?? {}).length > 0;
    //   if (!hasProductLeaflet && !hasBatchLeaflet) continue;

    //   items.push({
    //     productCode: owner.productCode,
    //     name: owner.productName,
    //     ...(hasBatchLeaflet && meta.batch?.batchNumber
    //       ? { batchNumber: meta.batch.batchNumber }
    //       : {}),
    //   });
    // }
    // return items;

    // let product: Product;
    // try {
    //   product = await this.service.read(value, ...ctxArgs);
    // } catch (e: unknown) {
    //   if (e instanceof NotFoundError) return [];
    //   throw e;
    // }

    // let meta;
    // try {
    //   meta = await this.leaflets.metadataPublicFallback(
    //     product.productCode,
    //     undefined,
    //     ...ctxArgs
    //   );
    // } catch (e: unknown) {
    //   if (e instanceof NotFoundError) return [];
    //   throw e;
    // }

    // const hasProductLeaflet =
    //   Object.keys(meta.leaflet?.pla?.product ?? {}).length > 0;
    // const hasBatchLeaflet =
    //   Object.keys(meta.leaflet?.pla?.batch ?? {}).length > 0;
    // if (!hasProductLeaflet && !hasBatchLeaflet) return [];

    // return [
    //   {
    //     productCode: product.productCode,
    //     name: product.inventedName ?? product.nameMedicinalProduct ?? "",
    //     ...(hasBatchLeaflet && meta.batch?.batchNumber
    //       ? { batchNumber: meta.batch.batchNumber }
    //       : {}),
    //   },
    // ];
  }

  protected async searchOwners(
    value: string,
    ...args: MaybeContextualArg<ContextOf<ProductService>, unknown[]>
  ): Promise<GtinOwner[]> {
    const repo = Repository.forModel(GtinOwner);
    const pageSize = 100;
    let offset = 1;
    let bookmark: string | number | undefined;
    const merged: GtinOwner[] = [];
    const seen = new Set<string>();

    do {
      const page: SerializedPage<GtinOwner> = await repo.page(
        value,
        OrderDirection.ASC,
        { offset, limit: pageSize, ...(bookmark && { bookmark }) },
        ...args
      );
      for (const owner of page.data) {
        const id = String(owner?.productCode ?? "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(owner);
      }
      bookmark = page.bookmark || undefined;
      offset++;
    } while (bookmark);

    return merged;
  }
}
