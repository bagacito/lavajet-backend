/**
 * Unit tests for the ew-backend Keycloak auth handler on the SSE events API.
 *
 * With `observerOptions.authenticate`, the AuthInterceptor runs on the events
 * stream (`/events`, `/events/:model`) and on `/events/subscribe|unsubscribe`.
 * Those requests never submit Fabric transactions, so `prime` must bind the
 * token's user (the stream's requester fingerprint) but skip the Fabric
 * identity lookup/re-enrollment — every stream (re)connection would otherwise
 * hit the Fabric CA. Every other authenticated route keeps its Fabric bindings.
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

import { FabricKeycloakAuthHandler } from "../../src/auth/keycloakAuthHandler";

describe("FabricKeycloakAuthHandler on the SSE events API", () => {
  const payload = {
    email: "alice@example.com",
    aud: "pharma-realm",
    realm_access: { roles: ["pla-writer"] },
  };

  function makeHandler() {
    const handler = new FabricKeycloakAuthHandler({} as any) as any;
    handler.jwtService = {
      decodePayload: jest.fn(() => payload),
      getTokenPayload: jest.fn(() => payload),
      decodeAuthToken: jest.fn(async () => payload),
    };
    handler.buildFabricBindings = jest.fn(async () => ({
      roles: ["pla-writer"],
      user: "alice@example.com",
      msp: "pharma-realm",
    }));
    return handler;
  }

  function request(method: string, path: string) {
    return { method, path, headers: { authorization: "Bearer jwt.token" } };
  }

  function context() {
    return { accumulate: jest.fn() };
  }

  it.each([
    ["GET", "/v1/events"],
    ["GET", "/events"],
    ["GET", "/v1/events?client=tab"],
    ["GET", "/v1/events/Product"],
    ["POST", "/v1/events/subscribe"],
    ["POST", "/v1/events/unsubscribe"],
  ])("%s %s is token-only: user bound, no Fabric identity lookup", async (method, path) => {
    const handler = makeHandler();
    const ctx = context();

    const data = await handler.prime(request(method, path), ctx);

    expect(data.user).toBe("alice@example.com");
    expect(handler.buildFabricBindings).not.toHaveBeenCalled();
    expect(ctx.accumulate).toHaveBeenCalledWith({ roles: ["pla-writer"] });
  });

  it.each([
    ["GET", "/v1/product"],
    ["GET", "/v1/eventsarchive"],
    ["PUT", "/v1/leaflet/events"],
  ])("%s %s keeps the Fabric identity bindings", async (method, path) => {
    const handler = makeHandler();
    const ctx = context();

    await handler.prime(request(method, path), ctx);

    expect(handler.buildFabricBindings).toHaveBeenCalledTimes(1);
    expect(ctx.accumulate).toHaveBeenCalledWith(
      expect.objectContaining({ user: "alice@example.com", msp: "pharma-realm" })
    );
  });
});
