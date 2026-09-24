/**
 * Unit tests for the LAVAJET-1016 / SAA-1162 `public/leaflet/external` write auth
 * change in `FabricKeycloakAuthHandler`.
 *
 * The handler now overrides `isPublicRequest()`/`parseFromRequest()` so that
 * write methods (POST/PUT/PATCH/DELETE) on `/public/leaflet/external/...` are
 * treated as authenticated (not public) — the caller still needs a token and
 * role/namespace bindings — while public GET routes remain public.
 *
 * These are plain unit tests (not Xray-reportable), so `it()`/`expect()` are
 * used. The Decaf/Nest auth stack is mocked because the handler sits at the
 * bottom of a deep provider chain; the point under test is the override logic
 * and the token/greeting extraction, not the framework role machinery.
 */

jest.mock("@decaf-ts/core", () => ({
  AuthorizationError: class extends Error {},
  Context: class {},
  ContextualArgs: {},
  PersistenceKeys: { AUTH_ROLE: "AuthRole" },
  Service: { get: jest.fn() },
}));
jest.mock("@decaf-ts/db-decorators", () => ({
  NotFoundError: class extends Error {},
}));
jest.mock("@decaf-ts/decoration", () => ({
  Metadata: { get: jest.fn(() => []) },
  Constructor: class {},
}));
jest.mock("@decaf-ts/decorator-validation", () => ({
  Model: { get: jest.fn() },
}));
jest.mock("@decaf-ts/for-fabric", () => ({
  CA_ROLE: { USER: "user" },
  IKeyValueAttribute: class {},
}));
jest.mock("@decaf-ts/for-nest", () => ({
  DecafRequestContext: class {},
}));
jest.mock("@decaf-ts/integrations/nest", () => {
  const isPublicRoute = (req: { path?: string }) =>
    req?.path?.startsWith("/public") === true;

  const getToken = (req: {
    headers?: Record<string, string | undefined>;
  }) => {
    const token =
      req?.headers?.["x-auth-request-access-token"] ??
      req?.headers?.["authorization"];
    if (!token) return undefined;
    return token.startsWith("Bearer ")
      ? token.slice("Bearer ".length)
      : token;
  };

  const extractKeycloakRoles = (payload: any): string[] => {
    const roles = new Set<string>();
    if (Array.isArray(payload?.realm_access?.roles)) {
      for (const role of payload.realm_access.roles) {
        if (!role?.startsWith("namespace:")) roles.add(role);
      }
    }
    if (payload?.resource_access && typeof payload.resource_access === "object") {
      for (const client of Object.keys(payload.resource_access)) {
        for (const role of payload.resource_access[client]?.roles ?? []) {
          if (!role?.startsWith("namespace:")) roles.add(role);
        }
      }
    }
    return [...roles];
  };

  const getRealmFromIssuer = (jwt: string): string => {
    const parts = jwt.split(".");
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    const url = new URL(payload.iss);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const realmsIndex = pathParts.indexOf("realms");
    return pathParts[realmsIndex + 1];
  };

  class MockKeycloakAuthHandler {
    jwtService: any;
    constructor() {}
    jwt() {
      return this.jwtService;
    }
    isPublicRequest(request: any): boolean {
      return isPublicRoute(request);
    }
    parseFromRequest(request: any): any {
      if (isPublicRoute(request)) {
        return { roles: [], token: "", isPublic: true };
      }
      const token = getToken(request);
      if (!token) throw new Error("Token not found");
      const payload = this.jwt().decodePayload(token);
      if (!payload) throw new Error("Invalid token");
      const roles = extractKeycloakRoles(payload);
      const organization =
        payload.aud || payload.azp || getRealmFromIssuer(token);
      const user = payload?.email ?? payload?.preferred_username;
      return { user, organization, roles, token, isPublic: false };
    }
    requestIpOf() {
      return "1.2.3.4";
    }
  }
  return {
    KeycloakAuthHandler: MockKeycloakAuthHandler,
    getClientRoles: jest.fn(() => ["admin"]),
    extractKeycloakRoles: jest.fn(extractKeycloakRoles),
    getRealmFromIssuer: jest.fn(getRealmFromIssuer),
    KeycloakAuthData: class {},
    KeycloakAccessTokenPayload: class {},
  };
});
jest.mock("@nestjs/common", () => ({
  Injectable: jest.fn(() => () => {}),
  SetMetadata: jest.fn(() => () => {}),
}));
jest.mock("@bagacito/lavajet-toolkit", () => ({
  FabricIdentity: class {},
  FabricIdentityService: class {},
  IsReaderAllowedKey: "isReaderAllowed",
}));
jest.mock("../../src/utils/environment", () => ({
  Environment: { verifyToken: true },
}));
jest.mock("../../src/auth/utils", () => ({
  getFabricAttributesFromCert: jest.fn(),
  hasAnyAllowedLevel: jest.fn(() => true),
  haveDifferentContent: jest.fn(() => false),
  isPla: jest.fn(() => false),
  isPlaReader: jest.fn(() => false),
  isWriter: jest.fn(() => true),
}));

import { AuthorizationError } from "@decaf-ts/core";
import { FabricKeycloakAuthHandler } from "../../src/auth/keycloakAuthHandler";

describe("FabricKeycloakAuthHandler public/leaflet/external write auth", () => {
  function makeHandler() {
    return new FabricKeycloakAuthHandler({} as any);
  }

  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];

  describe("isPublicRequest", () => {
    it("returns false for write methods on /public/leaflet/external/...", () => {
      const handler = makeHandler();
      for (const method of writeMethods) {
        const request = {
          method,
          path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
        };
        expect(
          (handler as any).isPublicRequest(request)
        ).toBe(false);
      }
    });

    it("returns false for write methods on /v1/public/leaflet/external/...", () => {
      const handler = makeHandler();
      for (const method of writeMethods) {
        const request = {
          method,
          path: "/v1/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
        };
        expect(
          (handler as any).isPublicRequest(request)
        ).toBe(false);
      }
    });

    it("returns true for GET on /public/leaflet/external/...", () => {
      const handler = makeHandler();
      const request = {
        method: "GET",
        path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
      };
      expect((handler as any).isPublicRequest(request)).toBe(true);
    });

    it("returns true for other /public read routes", () => {
      const handler = makeHandler();
      for (const path of [
        "/public/leaflet/gtin1",
        "/public/leaflet",
        "/public/some/other/read",
        "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
      ]) {
        expect((handler as any).isPublicRequest({ method: "GET", path })).toBe(
          true
        );
      }
    });

    it("falls through to the base public-path check for write methods on /public/leaflet (non-external)", () => {
      const handler = makeHandler();
      const request = {
        method: "POST",
        path: "/public/leaflet/gtin1",
      };
      // Not /public/leaflet/external, so the override does not force auth;
      // the base handler treats any /public path as public.
      expect((handler as any).isPublicRequest(request)).toBe(true);
    });

    it("returns true for a write with a query-string on the external path (path split on ?)", () => {
      const handler = makeHandler();
      const request = {
        method: "POST",
        path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf?download=1",
      };
      expect((handler as any).isPublicRequest(request)).toBe(false);
    });
  });

  describe("parseFromRequest", () => {
    it("returns authenticated data ({ isPublic: false, roles, user, organization, token }) for a write-on-public with a Bearer token", () => {
      const handler = makeHandler();
      const token = "jwt.token.here";
      (handler as any).jwtService = {
        decodePayload: jest.fn(() => ({
          email: "alice@example.com",
          aud: "pharma-realm",
          realm_access: { roles: ["pla-writer", "namespace:org1"] },
        })),
      };

      const result = (handler as any).parseFromRequest({
        method: "POST",
        path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(result).toEqual({
        isPublic: false,
        user: "alice@example.com",
        organization: "pharma-realm",
        roles: ["pla-writer"],
        token,
      });
      // namespace: roles are filtered out by extractKeycloakRoles
      expect(result.roles).not.toContain("namespace:org1");
    });

    it("reads the token from the x-auth-request-access-token header (no Bearer prefix)", () => {
      const handler = makeHandler();
      const token = "raw.access.token";
      (handler as any).jwtService = {
        decodePayload: jest.fn(() => ({
          preferred_username: "bob",
          azp: "account",
          resource_access: { account: { roles: ["reader"] } },
        })),
      };

      const result = (handler as any).parseFromRequest({
        method: "PATCH",
        path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
        headers: { "x-auth-request-access-token": token },
      });

      expect(result).toEqual({
        isPublic: false,
        user: "bob",
        organization: "account",
        roles: ["reader"],
        token,
      });
    });

    it("derives the organization from the issuer when aud/azp are absent", () => {
      const handler = makeHandler();
      const issuerToken = makeJwt({
        iss: "https://keycloak.example.com/realms/pharma",
        preferred_username: "carol",
        realm_access: { roles: ["reader"] },
      });
      (handler as any).jwtService = {
        decodePayload: jest.fn(() => ({
          iss: "https://keycloak.example.com/realms/pharma",
          preferred_username: "carol",
          realm_access: { roles: ["reader"] },
        })),
      };

      const result = (handler as any).parseFromRequest({
        method: "PUT",
        path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
        headers: { authorization: `Bearer ${issuerToken}` },
      });

      expect(result.organization).toBe("pharma");
      expect(result.user).toBe("carol");
      expect(result.isPublic).toBe(false);
    });

    it("throws AuthorizationError(\"Token not found\") for a write-on-public with no token", () => {
      const handler = makeHandler();
      (handler as any).jwtService = {
        decodePayload: jest.fn(),
      };

      expect(() =>
        (handler as any).parseFromRequest({
          method: "POST",
          path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
          headers: {},
        })
      ).toThrow(AuthorizationError);
      expect(() =>
        (handler as any).parseFromRequest({
          method: "DELETE",
          path: "/public/leaflet/external/gtin1/BATCH/leaflet/pt/en/file.pdf",
        })
      ).toThrow("Token not found");
    });
  });
});

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.signature`;
}
