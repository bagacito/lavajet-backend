/**
 * Unit tests for the ew-backend Keycloak auth handler logger binding consumer.
 *
 * Acceptance criterion 2 requires the `log.for(...)` chaining added by SAA-1121
 * to propagate at the application points. `FabricKeycloakAuthHandler.validate`
 * is one such point: it chains `logger.for(this.validate).for({ organization,
 * sessionId })` so auth logs carry the tenant + session. This suite drives the
 * real `validate` override (protected, invoked via bracket access) and asserts
 * both `.for(...)` hops are issued in order and that the bound logger is what
 * receives the debug lines.
 *
 * The Decaf/Nest auth stack is mocked because `validate` sits at the bottom of a
 * deep provider chain; the point under test is the consumer's binding calls, not
 * the framework role machinery.
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
  class MockKeycloakAuthHandler {
    constructor() {}
    async validate() {}
    requestIpOf() {
      return "1.2.3.4";
    }
  }
  return {
    KeycloakAuthHandler: MockKeycloakAuthHandler,
    getClientRoles: jest.fn(() => ["admin"]),
    extractKeycloakRoles: jest.fn(() => ["admin"]),
    getRealmFromIssuer: jest.fn(() => "realm"),
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

describe("FabricKeycloakAuthHandler logger binding consumer", () => {
  function boundLoggers() {
    const leaf = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    const mid = { for: jest.fn(() => leaf), debug: jest.fn() };
    const root = { for: jest.fn(() => mid), debug: jest.fn() };
    return { root, mid, leaf };
  }

  function makeHandler() {
    const handler = new FabricKeycloakAuthHandler({} as any);
    (handler as any).jwtService = {
      getTokenPayload: jest.fn(() => ({ sid: "sid-1" })),
      decodeAuthToken: jest.fn(async () => ({
        sid: "sid-1",
        email: "alice",
        preferred_username: "alice",
        realm_access: { roles: ["admin"] },
      })),
    };
    return handler;
  }

  it("chains .for(this.validate).for({ organization, sessionId }) and logs on the bound logger", async () => {
    const { root, mid, leaf } = boundLoggers();
    const handler = makeHandler();
    const requestContext = {
      request: { method: "GET", url: "/api/account" },
      logger: root,
    };

    await (handler as any).validate(
      {
        isPublic: false,
        organization: "Org1",
        token: "jwt.token.here",
        user: "alice",
        roles: ["admin"],
      },
      undefined,
      undefined,
      undefined,
      undefined,
      requestContext
    );

    // 1st hop: bind the handler method as the log source
    expect(root.for).toHaveBeenCalledWith(expect.any(Function));
    // 2nd hop: bind organization + session metadata
    expect(mid.for).toHaveBeenCalledWith({
      organization: "Org1",
      sessionId: "sid-1",
    });
    // both debug lines are emitted on the fully-bound leaf logger
    expect(leaf.debug).toHaveBeenCalledTimes(2);
    expect(leaf.debug).toHaveBeenCalledWith(
      expect.stringContaining("Validating token for GET /api/account")
    );
  });

  it("binds the client ip onto the identity-service log via .for({ ip }) on identity lookup failure", async () => {
    const handler = makeHandler();
    const ipBound = { error: jest.fn() };
    const log = { for: jest.fn(() => ipBound), error: jest.fn() };
    (handler as any).identityService = {
      log,
      getUserCredentials: jest.fn().mockRejectedValue(new Error("boom")),
    };

    await expect(
      (handler as any).buildFabricBindings(
        {
          isPublic: false,
          organization: "Org1",
          token: "jwt.token",
          user: "alice",
          roles: ["admin"],
        },
        { method: "GET", url: "/x" }
      )
    ).rejects.toThrow("boom");

    expect(log.for).toHaveBeenCalledWith({ ip: "1.2.3.4" });
    expect(ipBound.error).toHaveBeenCalledWith("ACCESS FAIL", expect.any(Error));
  });
});
