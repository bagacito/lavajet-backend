import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "path";

const envPublicFile = path.join(__dirname, "../../../.env.local");
const envPrivateFile = path.join(__dirname, "../../../.env.secret");
const envssoFile = path.join(__dirname, "../../../.env.sso");
const env = dotenv.config({
  path: [envssoFile, envPrivateFile, envPublicFile],
});
dotenvExpand.expand(env);

import request from "supertest";
import { DecafRequestHandlerInterceptor } from "@decaf-ts/for-nest";
import { FabricKeycloakAuthHandler } from "../../src/auth/keycloakAuthHandler";
import { closeApp, getApp } from "./app";

describe("leaflet auth order", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let authSpy: jest.SpyInstance<ReturnType<FabricKeycloakAuthHandler["authorize"]>>;
  let decafSpy: jest.SpyInstance<
    ReturnType<DecafRequestHandlerInterceptor["intercept"]>
  >;

  beforeAll(async () => {
    authSpy = jest
      .spyOn(FabricKeycloakAuthHandler.prototype, "authorize")
      .mockResolvedValue(undefined);
    decafSpy = jest.spyOn(
      DecafRequestHandlerInterceptor.prototype,
      "intercept"
    );
    app = await getApp();
  }, 60000);

  afterAll(async () => {
    await closeApp();
    authSpy.mockRestore();
    decafSpy.mockRestore();
  }, 180000);

  it("runs authorization before the Decaf request pipeline", async () => {
    await request(app.getHttpServer())
      .get("/leaflet/test-product/test-batch/test-lang/test-epi")
      .set("Authorization", "Bearer test")
      .expect(404);

    expect(authSpy).toHaveBeenCalled();
    expect(decafSpy).toHaveBeenCalled();
    expect(authSpy.mock.invocationCallOrder[0]).toBeLessThan(
      decafSpy.mock.invocationCallOrder[0]
    );
  }, 30000);
});
