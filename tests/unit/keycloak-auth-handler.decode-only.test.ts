/**
 * Unit tests for the ew-backend Keycloak auth handler decode-only refusal
 * (SAA-1181 / LAVAJET-1016, item 2).
 *
 * When `Environment.verifyToken` is falsy (e.g. `VERIFY_TOKEN=false`),
 * `JwtService.decodeAuthToken` runs decode-only: it base64-decodes the token
 * claims without checking the signature. In that state the signature-
 * verification remediation (SAA-1168) is inert, so a forged token could drive
 * `registerAndEnroll`/`reenroll`. To keep the authenticated-request path
 * fail-secure, `buildFabricBindings` must refuse any Fabric CA side effect.
 *
 * This suite drives the real `buildFabricBindings` (protected, bracket access)
 * with `verifyToken` mocked to `false` and asserts the request is rejected with
 * `AuthorizationError` and that neither `getUserCredentials`,
 * `registerAndEnroll` nor `reenroll` are EVER called.
 *
 * These are plain unit tests (not Xray-reportable), so `it()`/`expect()` are used.
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
    async prime(request: any): Promise<any> {
      return this.parseFromRequest(request);
    }
    async validateAuth(data: any): Promise<void> {
      if (data.isPublic) return;
      if (!data.token) throw new Error("Token not found");
      await this.jwt().decodeAuthToken(data.token);
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
  Environment: { verifyToken: false },
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

describe("FabricKeycloakAuthHandler decode-only refusal (SAA-1181)", () => {
  /** A structurally valid JWT (signature is irrelevant here). */
  function validShapeJWT(payload: Record<string, unknown>): string {
    const encode = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(
      payload
    )}.this-is-a-forged-signature`;
  }

  function makeHandler() {
    return new FabricKeycloakAuthHandler({} as any);
  }

  it("REGRESSION: buildFabricBindings refuses enrollment in decode-only mode and never calls the Fabric CA", async () => {
    const handler = makeHandler();
    const forgedToken = validShapeJWT({
      email: "attacker@evil.example",
      aud: "pharma-realm",
      realm_access: { roles: ["pla-admin"] },
    });
    const registerAndEnroll = jest.fn().mockResolvedValue(undefined);
    const reenroll = jest.fn().mockResolvedValue(undefined);
    // The refusal path logs through `logger.for({ ip }).error(...)`.
    const boundError = jest.fn();
    const logErrorFn = jest.fn();

    // decode-only: decodeAuthToken just base64-decodes (no signature check).
    (handler as any).jwtService = {
      decodePayload: jest.fn(() => ({
        email: "attacker@evil.example",
        aud: "pharma-realm",
        realm_access: { roles: ["pla-admin"] },
      })),
      decodeAuthToken: jest.fn(async () => ({
        email: "attacker@evil.example",
        aud: "pharma-realm",
        realm_access: { roles: ["pla-admin"] },
      })),
    };
    (handler as any).identityService = {
      log: {
        info: jest.fn(),
        error: logErrorFn,
        for: jest.fn(() => ({ info: jest.fn(), error: boundError })),
      },
      getUserCredentials: jest.fn(),
      registerAndEnroll,
      reenroll,
    };

    const data = (handler as any).parseFromRequest({
      method: "POST",
      path: "/api/account",
      headers: { authorization: `Bearer ${forgedToken}` },
    });

    await expect(
      (handler as any).buildFabricBindings(data, {
        method: "POST",
        url: "/api/account",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(registerAndEnroll).not.toHaveBeenCalled();
    expect(reenroll).not.toHaveBeenCalled();
    expect(
      (handler as any).identityService.getUserCredentials
    ).not.toHaveBeenCalled();
    // A loud error-level warning is emitted before refusing (ip-bound logger).
    expect(boundError).toHaveBeenCalled();
  });

  it("decode-only refusal also applies when the token carries no user (roles-only path never binds unverified roles)", async () => {
    const handler = makeHandler();
    const forgedToken = validShapeJWT({
      aud: "pharma-realm",
      realm_access: { roles: ["pla-admin"] },
    });
    const registerAndEnroll = jest.fn().mockResolvedValue(undefined);
    const reenroll = jest.fn().mockResolvedValue(undefined);

    (handler as any).jwtService = {
      decodePayload: jest.fn(() => ({
        aud: "pharma-realm",
        realm_access: { roles: ["pla-admin"] },
      })),
      decodeAuthToken: jest.fn(async () => ({
        aud: "pharma-realm",
        realm_access: { roles: ["pla-admin"] },
      })),
    };
    (handler as any).identityService = {
      log: { info: jest.fn(), error: jest.fn() },
      getUserCredentials: jest.fn(),
      registerAndEnroll,
      reenroll,
    };

    const data = (handler as any).parseFromRequest({
      method: "POST",
      path: "/api/account",
      headers: { authorization: `Bearer ${forgedToken}` },
    });

    await expect(
      (handler as any).buildFabricBindings(data, {
        method: "POST",
        url: "/api/account",
      })
    ).rejects.toThrow(AuthorizationError);

    expect(registerAndEnroll).not.toHaveBeenCalled();
    expect(reenroll).not.toHaveBeenCalled();
    expect(
      (handler as any).identityService.getUserCredentials
    ).not.toHaveBeenCalled();
  });
});
