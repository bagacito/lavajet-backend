import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  Repository,
  Repo,
  UnsupportedError,
  OrderDirection,
} from "@decaf-ts/core";
import {
  Auth,
  DecafModelController,
  DecafRequestContext,
} from "@decaf-ts/for-nest";
import { ModelConstructor } from "@decaf-ts/decorator-validation";
import { BadRequestError, OperationKeys } from "@decaf-ts/db-decorators";
import { Batch, Leaflet, Product } from "@bagacito/lavajet-toolkit";
import { DeprecatedInterceptor } from "../../interceptors";

@UseInterceptors(DeprecatedInterceptor)
@ApiTags("/integration")
@Controller()
@Auth(Product)
export class IntegrationLegacyRoutesController extends DecafModelController<Product> {
  pk: keyof Product = "productCode" as const;

  override get class(): ModelConstructor<Product> {
    return Product;
  }

  private _leafletRepo!: any;
  private get leafletRepo() {
    if (!this._leafletRepo)
      this._leafletRepo = Repository.forModel(Leaflet).override(
        this.clientContext.toOverrides()
      );
    return this._leafletRepo;
  }

  private _batchRepo!: Repo<Batch>;

  private get batchRepo() {
    if (!this._batchRepo)
      this._batchRepo = Repository.forModel(Batch).override(
        this.clientContext.toOverrides()
      );
    return this._batchRepo;
  }

  private _productRepo!: Repo<Product>;

  private get productRepo() {
    if (!this._productRepo)
      this._productRepo = Repository.forModel(Product).override(
        this.clientContext.toOverrides()
      );
    return this._productRepo;
  }

  constructor(clientContext: DecafRequestContext) {
    super(clientContext, "IntegrationLegacyRoutesController");
  }

  @Get("listProductLangs/:gtin/:epiType")
  @ApiOperation({
    summary: "List product languages",
    deprecated: true,
  })
  async listProductsLangs(
    @Param("gtin") gtin: string,
    @Param("epiType") epiType: string
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.listProductsLangs
    );
    const leaflets = await this.leafletRepo
      .select()
      .where(
        this.leafletRepo
          .attr("productCode")
          .eq(gtin)
          .and(this.leafletRepo.attr("leafletType").eq(epiType))
      )
      .execute();

    return [...new Set(leaflets?.map((leaflet) => leaflet.lang) || [])];
  }

  @Get("listBatchLangs/:gtin/:batchNumber/:epiType")
  @ApiOperation({
    summary: "List batch languages",
    deprecated: true,
  })
  async listBatchLangs(
    @Param("gtin") gtin: string,
    @Param("batchNumber") batchNumber: string,
    @Param("epiType") epiType: string
  ) {
    const leafletsLangs = await this.leafletRepo
      .select(["lang"])
      .where(
        this.leafletRepo
          .attr("productCode")
          .eq(gtin)
          .and(
            this.leafletRepo
              .attr("batchNumber")
              .eq(batchNumber)
              .and(this.leafletRepo.attr("leafletType").eq(epiType))
          )
      )
      .execute();
    return leafletsLangs?.map((item) => item.lang) || [];
  }

  @Get("listProducts")
  @ApiOperation({
    summary: "List products",
    deprecated: true,
  })
  async listProducts(
    @Query("start") start: number = 0,
    @Query("number") number: number = 1000,
    @Query("sort") sort: OrderDirection = OrderDirection.ASC,
    @Query("filter") filter: string
  ) {
    const { ctx } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.listProducts
    );

    const startNumber = Number(start);
    if (!Number.isInteger(startNumber)) {
      throw new BadRequestError("page must be an integer");
    }
    if (startNumber < 1) {
      throw new BadRequestError("page must be bigger then 1");
    }

    const elementsNumber = Number(number);
    if (!Number.isInteger(elementsNumber)) {
      throw new BadRequestError("page must be an integer");
    }

    const paginator = await this.productRepo
      .select()
      .orderBy("createdAt", sort)
      .paginate(elementsNumber);

    let page;
    const bookmark = await paginator.page();
    if (startNumber == 1) {
      page = bookmark;
    } else {
      page = await paginator.page(startNumber);
    }
    const productCodes = page.map((product) => product.productCode);

    if (!productCodes.length) return page;

    const hydratedProducts = await this.productRepo.readAll(productCodes, ctx);
    return hydratedProducts;
  }

  @Get("listBatches")
  @ApiOperation({
    summary: "List batches",
    deprecated: true,
  })
  async listBatches(
    @Query("start") start: number = 0,
    @Query("number") number: number = 1000,
    @Query("sort") sort: OrderDirection = OrderDirection.ASC,
    @Query("filter") filter: string
  ) {
    const { ctx, log } = (await this.logCtx([], OperationKeys.READ, true)).for(
      this.listBatches
    );

    const startNumber = Number(start);
    if (!Number.isInteger(startNumber)) {
      throw new BadRequestError("page must be an integer");
    }

    if (startNumber < 1) {
      throw new BadRequestError("page must be bigger then 1");
    }

    const elementsNumber = Number(number);
    if (!Number.isInteger(elementsNumber)) {
      throw new BadRequestError("page must be an integer");
    }

    const paginator = await this.batchRepo
      .select()
      .orderBy("createdAt", sort)
      .paginate(elementsNumber);

    let page;
    const bookmark = await paginator.page();
    if (startNumber == 1) {
      page = bookmark;
    } else {
      page = await paginator.page(startNumber);
    }
    const batchCodes = page.map((batch) =>
      [batch.productCode, batch.batchNumber].join(":")
    );

    if (!batchCodes.length) return page;

    const hydratedProducts = await this.batchRepo.readAll(batchCodes, ctx);
    return hydratedProducts;
  }
}
