import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";
import { PublicLeafletResolverController } from "./leaflet-resolver/public-leaflet-resolver.controller";
import { OwnerController } from "./owner/owner.controller";
import { PublicProductController } from "./product/product.controller";
import { ValidateController } from "./validate/validate.controller";

@Module({
  imports: [
    RouterModule.register([
      {
        path: "public",
        module: PublicPlaModule,
      },
    ]),
  ],

  controllers: [
    OwnerController,
    ValidateController,
    PublicProductController,
    PublicLeafletResolverController,
  ],
  providers: [],
})
export class PublicPlaModule {}
