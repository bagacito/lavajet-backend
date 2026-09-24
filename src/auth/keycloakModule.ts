import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { Service as DecafService } from "@decaf-ts/core";
import { AUTH_HANDLER, AuthInterceptor } from "@decaf-ts/for-nest";
// import {
//   FabricIdentity,
//   FabricIdentityService,
// } from "@bagacito/lavajet-toolkit";
import "./jwtService";
import { JwtService } from "./jwtService";
import { FabricKeycloakAuthHandler } from "./keycloakAuthHandler";

@Global()
@Module({
  providers: [
    AuthInterceptor,
    JwtService,
    {
      provide: "jwt",
      useExisting: JwtService,
    },
    // {
    //   provide: FabricIdentityService,
    //   useFactory: () =>
    //     DecafService.get(FabricIdentity as any) as FabricIdentityService,
    // },
    FabricKeycloakAuthHandler,
    {
      provide: AUTH_HANDLER,
      useClass: FabricKeycloakAuthHandler,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuthInterceptor,
    },
  ],
  exports: [AUTH_HANDLER, AuthInterceptor, JwtService, "jwt"],
})
export class AuthModule {}
