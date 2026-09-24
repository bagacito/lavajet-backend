import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { KibanaController } from "./kibana.controller";
import { KibanaProxyService } from "./kibana-middleware";
import { KibanaSessionGuard } from "./kibana-session.guard";
import { FabricKeycloakAuthHandler } from "../auth";
import { KibanaCspMiddleware } from "./kibana-csp.middleware";

@Module({
  controllers: [KibanaController],
  providers: [KibanaProxyService, KibanaSessionGuard, FabricKeycloakAuthHandler],
})
export class KibanaModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(KibanaCspMiddleware)
      .forRoutes({ path: "kibana/*path", method: RequestMethod.ALL });
  }
}
