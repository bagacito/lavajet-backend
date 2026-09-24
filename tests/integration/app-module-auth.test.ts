import { JwtService } from "@decaf-ts/crypto/integration/services/jwt";
import { Service as DecafService } from "@decaf-ts/core";
import { AccountController } from "../../src/api/account/account.controller";
import { FabricKeycloakAuthHandler } from "../../src/auth";
import { closeApp, getApp } from "./app-ew";

describe("AppModule auth wiring", () => {
  let app: Awaited<ReturnType<typeof getApp>>;

  beforeAll(async () => {
    app = await getApp();
  }, 60000);

  afterAll(async () => {
    await closeApp();
  }, 180000);

  it("shares the AppModule JwtService with the account controller", async () => {
    const jwtService = DecafService.get(JwtService);
    const controller = await app.resolve(AccountController);

    expect((controller as any).jwtService).toBe(jwtService);
    expect((controller as any).accountConfigService).toBeDefined();
  });

  it("shares the AppModule JwtService with the fabric auth handler", async () => {
    const jwtService = DecafService.get(JwtService);
    const handler = await app.resolve(FabricKeycloakAuthHandler);

    expect((handler as any).jwtService).toBe(jwtService);
    expect((handler as any).identityService).toBeDefined();
  });
});
