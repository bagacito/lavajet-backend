import { OrderDirection } from "@decaf-ts/core";
import { Public, Service } from "@decaf-ts/for-nest";
import {
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  Leaflet,
  LeafletService,
  LeafletResolver,
  LeafletResolverService,
  ProductLeafletResolverService,
} from "@bagacito/lavajet-toolkit";

@ApiTags("leaflet resolver public api")
@Controller("leaflet-resolver")
export class PublicLeafletResolverController {
  constructor(
    @Service(LeafletResolver) private readonly service: LeafletResolverService,
    @Service(Leaflet) private readonly leafletService: LeafletService,
    @Service()
    private readonly productLeafletResolverService: ProductLeafletResolverService
  ) {}

  @Get("listBy/:key")
  @ApiOperation({ summary: "List leaflet resolvers by a field" })
  @ApiQuery({
    name: "direction",
    required: true,
    enum: OrderDirection,
  })
  async listBy(
    @Param("key") key: string,
    @Query("direction", new ParseEnumPipe(OrderDirection))
    direction: OrderDirection
  ): Promise<LeafletResolver[]> {
    return this.service.listBy(key as keyof LeafletResolver, direction);
  }
}
