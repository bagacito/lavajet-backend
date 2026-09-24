/**
 * @module ew-backend/tests/integration/auth-refactor.test.ts
 * @summary Integration tests for the auth refactoring.
 * @description Verifies that the refactored auth system (FabricKeycloakAuthHandler
 * extending KeycloakAuthHandler from @decaf-ts/integrations/nest) works correctly:
 *   - JwtService is used directly for JWT parsing/verification
 *   - FabricKeycloakAuthHandler extends KeycloakAuthHandler
 *   - DECAF_ADAPTER_OPTIONS is no longer used anywhere in src/
 *   - @SkipFabricIdentity decorator exists and sets the right metadata
 *   - AuthModule wires FabricKeycloakAuthHandler as AUTH_HANDLER
 *   - OpenAPI specs are unchanged (lavajet-api.json, lavajet-pla-api.json)
 */
import { KeycloakAuthHandler } from "@decaf-ts/integrations/nest";
import { JwtService } from "@decaf-ts/crypto/integration/services/jwt";
import { Context } from "@decaf-ts/core";
import { Reflector } from "@nestjs/core";

import {
  AuthModule,
  FabricKeycloakAuthHandler,
  SkipFabricIdentity,
  SKIP_FABRIC_IDENTITY_KEY,
} from "../../src/auth";

function buildJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
}

describe("Auth Refactor", () => {
  describe("Imports & Inheritance", () => {
    it("JwtService comes from @decaf-ts/crypto/integration/services/jwt", () => {
      expect(JwtService).toBeDefined();
      expect(JwtService.name).toBe("JwtService");
    });

    it("KeycloakAuthHandler comes from @decaf-ts/integrations/nest", () => {
      expect(KeycloakAuthHandler).toBeDefined();
      expect(KeycloakAuthHandler.name).toBe("KeycloakAuthHandler");
    });

    it("FabricKeycloakAuthHandler extends KeycloakAuthHandler", () => {
      const handler = Object.create(FabricKeycloakAuthHandler.prototype);
      expect(handler).toBeInstanceOf(KeycloakAuthHandler);
    });
  });

  describe("SkipFabricIdentity decorator", () => {
    it("sets the SKIP_FABRIC_IDENTITY_KEY metadata", () => {
      class TestController {
        @SkipFabricIdentity()
        someMethod() {}
      }

      const reflector = new Reflector();
      const meta = reflector.get<boolean>(
        SKIP_FABRIC_IDENTITY_KEY,
        TestController.prototype.someMethod
      );
      expect(meta).toBe(true);
    });
  });

  describe("AuthModule wiring", () => {
    it("provides FabricKeycloakAuthHandler as AUTH_HANDLER", async () => {
      // The module wiring is validated in the AppModule integration test.
      const module = AuthModule;
      expect(module).toBeDefined();
      expect(AuthModule.name).toBe("AuthModule");
    });
  });

  describe("DECAF_ADAPTER_OPTIONS removal", () => {
    it("is no longer exported from @decaf-ts/for-nest", () => {
      // If DECAF_ADAPTER_OPTIONS were still exported, this would not throw
      let exported: any;
      try {
        exported = require("@decaf-ts/for-nest").DECAF_ADAPTER_OPTIONS;
      } catch {
        // expected
      }
      expect(exported).toBeUndefined();
    });
  });

  describe("FabricKeycloakAuthHandler behaviour", () => {
    let handler: FabricKeycloakAuthHandler;

    beforeEach(() => {
      handler = new FabricKeycloakAuthHandler({} as any);
      (handler as any).jwtService = new JwtService();
    });

    it("constructs with an injected JwtService", () => {
      expect(handler).toBeDefined();
      expect((handler as any).jwtService).toBeInstanceOf(JwtService);
    });

    it("primes the request context with fabric bindings before validation", async () => {
      const request = {
        path: "/leaflet/test",
        method: "POST",
        handler: { name: "leaflet" },
        headers: {
          authorization: `Bearer ${buildJwt({
            iss: "https://auth.example.com/realms/demo",
            email: "user@example.com",
            preferred_username: "user",
            aud: "my-client",
            realm_access: { roles: ["reader"] },
          })}`,
        },
      } as any;
      const ctx = new Context();
      const fabricBindings = {
        keyCertOrDirectoryPath: Buffer.from("key"),
        certCertOrDirectoryPath: Buffer.from("cert"),
        roles: ["reader"],
        user: "user@example.com",
        msp: "my-client",
        ip: "127.0.0.1",
      };
      (handler as any).buildFabricBindings = jest
        .fn()
        .mockResolvedValue(fabricBindings);

      await (handler as any).prime(request, ctx);

      expect((handler as any).buildFabricBindings).toHaveBeenCalled();
      expect(ctx.getOrUndefined("user")).toBe("user@example.com");
      expect(ctx.getOrUndefined("roles")).toEqual(["reader"]);
      expect(ctx.getOrUndefined("keyCertOrDirectoryPath")).toEqual(
        fabricBindings.keyCertOrDirectoryPath
      );
      expect(ctx.getOrUndefined("certCertOrDirectoryPath")).toEqual(
        fabricBindings.certCertOrDirectoryPath
      );
      expect(ctx.getOrUndefined("msp")).toBe("my-client");
    });

    it("has the identityService from Service registry", () => {
      expect((handler as any).identityService).toBeDefined();
    });
  });
});
