import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Service } from "@decaf-ts/for-nest";
import { LoggedClass } from "@decaf-ts/logging";
import { ProductLeafletResolverService } from "@bagacito/lavajet-toolkit";
import { Environment } from "./environment";

@Injectable()
export class ResolverTasksService extends LoggedClass {
  constructor(
    @Service()
    private readonly productLeafletResolverService: ProductLeafletResolverService
  ) {
    super();
  }

  @Cron(Environment.resolver.cronTime.long)
  async nonResolvedProductTask() {
    this.log
      .for(this.nonResolvedProductTask)
      .info("Starting unresolved-products resolver task");

    await this.productLeafletResolverService.queueUnresolvedProducts(
      Environment.serviceAccount
    );
  }

  @Cron(Environment.resolver.cronTime.short)
  async nonResolvedProductWithNoLeafletsTask() {
    this.log
      .for(this.nonResolvedProductWithNoLeafletsTask)
      .info("Starting unresolved-products-without-leaflets resolver task");

    await this.productLeafletResolverService.queueUnresolvedProductsWithoutLeaflets(
      Environment.serviceAccount
    );
  }
}
