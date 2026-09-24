/**
 * Regression test for SAA-1168 / LAVAJET-1016: the Fabric identity enrollment path
 * must verify the JWT signature BEFORE any Fabric CA side effect.
 *
 * Before the fix, `buildFabricBindings` ran with `data.roles`/`data.user`
 * derived from an *unverified* base64 payload decode (`decodePayload`). A
 * forged token with a valid shape but a bad signature could therefore drive
 * `identityService.registerAndEnroll`/`reenroll` with attacker-chosen roles for
 * an arbitrary email — a persistent, unauthenticated-reachable CA side effect.
 *
 * This suite drives the real `buildFabricBindings` (protected, bracket access)
 * against a valid-shape / bad-signature JWT and asserts:
 * - the signature verification rejects the request (the `AuthorizationError`
 *   the AuthInterceptor maps to a 401), and
 * - `identityService.registerAndEnroll`/`reenroll` are NEVER called.
 *
 * `validateAuth` is also exercised to prove the authorize signature gate still
 * hard-rejects a bad-signature token (prime's best-effort contract is untouched).
 *
 * The core regression test (`buildFabricBindings` -> zero enrollment calls)
 * demonstrably FAILS against the pre-fix code, where `decodeAuthToken` was not
 * called and `registerAndEnroll` was reached for a not-found identity.
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

import { AuthorizationError } from "@decaf-ts/core";
import { NotFoundError } from "@decaf-ts/db-decorators";
import { FabricKeycloakAuthHandler } from "../../src/auth/keycloakAuthHandler";

describe("FabricKeycloakAuthHandler signature-verified enrollment (SAA-1168)", () => {
  /** A structurally valid JWT whose signature is NOT verifiable (bad signature). */
  function validShapeBadSignature(
    payload: Record<string, unknown>
  ): string {
    const encode = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(
      payload
    )}.this-is-a-forged-signature`;
  }

  function makeHandler() {
    return new FabricKeycloakAuthHandler({} as any);
  }

  it("REGRESSION: buildFabricBindings rejects a valid-shape bad-signature JWT and never enrolls", async () => {
    const handler = makeHandler();
    const badToken = validShapeBadSignature({
      email: "attacker@evil.example",
      aud: "pharma-realm",
      realm_access: { roles: ["pla-admin"] },
    });
    const registerAndEnroll = jest.fn().mockResolvedValue(undefined);
    const reenroll = jest.fn().mockResolvedValue(undefined);

    (handler as any).jwtService = {
      decodePayload: jest.fn(() => ({
        email: "attacker@evil.example",
        aud: "pharma-realm",
        realm_access: { roles: ["pla-admin"] },
      })),
      decodeAuthToken: jest
        .fn()
        .mockRejectedValue(new AuthorizationError("Invalid token")),
    };
    (handler as any).identityService = {
      log: { info: jest.fn(), error: jest.fn() },
      getUserCredentials: jest
        .fn()
        .mockRejectedValue(new NotFoundError("identity not found")),
      registerAndEnroll,
      reenroll,
    };

    // Parse the authenticated route (unverified decode succeeds, but the token
    // signature is forged) and then run the enrollment-binding path.
    const data = (handler as any).parseFromRequest({
      method: "POST",
      path: "/api/account",
      headers: { authorization: `Bearer ${badToken}` },
    });

    await expect(
      (handler as any).buildFabricBindings(data, {
        method: "POST",
        url: "/api/account",
      })
    ).rejects.toThrow(AuthorizationError);

    // Never reach the Fabric CA side effects.
    expect(registerAndEnroll).not.toHaveBeenCalled();
    expect(reenroll).not.toHaveBeenCalled();
    expect((handler as any).identityService.getUserCredentials).not.toHaveBeenCalled();
  });

  it("validateAuth (authorize signature gate) hard-rejects a bad-signature JWT with AuthorizationError -> 401", async () => {
    const handler = makeHandler();
    const badToken = validShapeBadSignature({ email: "attacker@evil.example" });

    (handler as any).jwtService = {
      decodePayload: jest.fn(() => ({ email: "attacker@evil.example" })),
      decodeAuthToken: jest
        .fn()
        .mockRejectedValue(new AuthorizationError("Invalid token")),
    };

    await expect(
      (handler as any).validateAuth(
        {
          isPublic: false,
          user: "attacker@evil.example",
          roles: ["pla-admin"],
          token: badToken,
        },
        { method: "POST", url: "/api/account" }
      )
    ).rejects.toThrow(AuthorizationError);
  });

  it("still binds Fabric identity for a signature-VERIFIED token (happy path unchanged)", async () => {
    const handler = makeHandler();
    const verifiedToken = validShapeBadSignature({
      email: "alice@example.com",
      aud: "pharma-realm",
      realm_access: { roles: ["pla-writer"] },
    });
    const registerAndEnroll = jest.fn().mockResolvedValue(undefined);
    const reenroll = jest.fn().mockResolvedValue(undefined);

    // A valid signature: decodeAuthToken resolves to the signed payload.
    (handler as any).jwtService = {
      decodePayload: jest.fn(() => ({
        email: "alice@example.com",
        aud: "pharma-realm",
        realm_access: { roles: ["pla-writer"] },
      })),
      decodeAuthToken: jest.fn(async () => ({
        email: "alice@example.com",
        aud: "pharma-realm",
        realm_access: { roles: ["pla-writer"] },
      })),
    };
    (handler as any).identityService = {
      log: { info: jest.fn(), error: jest.fn() },
      getUserCredentials: jest
        .fn()
        .mockRejectedValueOnce(new NotFoundError("identity not found"))
        .mockResolvedValueOnce({
          privateKey: "priv-key",
          certificate: "cert-pem",
        }),
      registerAndEnroll,
      reenroll,
    };

    const data = (handler as any).parseFromRequest({
      method: "POST",
      path: "/api/account",
      headers: { authorization: `Bearer ${verifiedToken}` },
    });

    const bindings = await (handler as any).buildFabricBindings(data, {
      method: "POST",
      url: "/api/account",
    });

    expect(registerAndEnroll).toHaveBeenCalledTimes(1);
    expect(reenroll).not.toHaveBeenCalled();
    expect(bindings.user).toBe("alice@example.com");
    expect(bindings.roles).toEqual(["pla-writer"]);
    expect(bindings.msp).toBe("pharma-realm");
  });

  it("REGRESSION (SAA-1181): buildFabricBindings fails closed when the token is absent (no unverified claims pass through)", async () => {
    const handler = makeHandler();
    const registerAndEnroll = jest.fn().mockResolvedValue(undefined);
    const reenroll = jest.fn().mockResolvedValue(undefined);

    (handler as any).jwtService = {
      decodePayload: jest.fn(),
      decodeAuthToken: jest.fn(),
    };
    (handler as any).identityService = {
      log: { info: jest.fn(), error: jest.fn() },
      getUserCredentials: jest.fn(),
      registerAndEnroll,
      reenroll,
    };

    // `data.user`/`roles`/`organization` are unverified decode fields; with no
    // token there is nothing to verify, so the enrollment gate must never pass
    // them through to the Fabric CA.
    const data = {
      user: "attacker@evil.example",
      organization: "pharma-realm",
      roles: ["pla-admin"],
      token: "",
      isPublic: false,
    };

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

  it("verifyAndExtractEnrollmentPayload throws 'Token not found' when no token is present", async () => {
    const handler = makeHandler();
    (handler as any).jwtService = { decodeAuthToken: jest.fn() };

    await expect(
      (handler as any).verifyAndExtractEnrollmentPayload({
        token: undefined,
        organization: "pharma-realm",
        roles: ["pla-admin"],
      })
    ).rejects.toThrow("Token not found");
  });
});
