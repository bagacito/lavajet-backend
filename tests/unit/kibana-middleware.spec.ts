/**
 * Unit tests for kibana-middleware pure helpers and the KibanaProxyService.handle() enforcements.
 *
 * Strategy:
 *  - The three pure exported functions (isSpaceEscapeAttempt, computeEmbedFlags,
 *    rewriteDashboardUrl) are tested without any mocks — they are deterministic.
 *  - KibanaProxyService.handle() is tested with minimal mocks:
 *      • http-proxy-middleware is stubbed so no real proxy is created.
 *      • jose.decodeJwt is mocked per-test to return controlled payloads.
 *      • getClientRoles is mocked per-test to return controlled role arrays.
 *      • Environment is mocked at module level so the module-level constants
 *        (realm, topMenu, queryInput, refreshInterval) are stable.
 */

// ── Module mocks ──────────────────────────────────────────────────────────────
// These must be declared before any imports so jest can hoist them.

jest.mock("http-proxy-middleware", () => ({
  createProxyMiddleware: jest.fn(() => jest.fn()),
}));

jest.mock("../../src/utils/environment", () => ({
  Environment: {
    kibana: {
      realm: "test-org",
      hostProtocol: "https",
      host: "kibana.test.internal",
      realmApiUsername: "test-user",
      realmApiPassword: "test-pass",
      adminApiUsername: "admin",
      adminApiPassword: "admin-pass",
      topMenu: false,
      queryInput: false,
      timeFilter: true,
      refreshInterval: 60000,
    },
    verifyToken: true, // overridden per test where needed
  },
}));

jest.mock("../../src/auth/keycloakAuthHandler", () => ({
  FabricKeycloakAuthHandler: jest.fn(),
  SkipFabricIdentity: jest.fn(),
}));

jest.mock("@decaf-ts/integrations/nest", () => ({
  getClientRoles: jest.fn(),
  AuthService: jest.fn(),
  KeycloakAuthHandler: jest.fn(),
}));

jest.mock("jose", () => ({
  decodeJwt: jest.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { AuthorizationError } from "@decaf-ts/core";
import {
  isSpaceEscapeAttempt,
  computeEmbedFlags,
  rewriteDashboardUrl,
  KibanaProxyService,
  EmbedFlags,
} from "../../src/kibana/kibana-middleware";
import { getClientRoles } from "@decaf-ts/integrations/nest";
import { decodeJwt } from "jose";
import { Environment } from "../../src/utils/environment";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Record<string, any> = {}): any {
  return {
    path: "/s/test-org/app/dashboards",
    url: "/s/test-org/app/dashboards?embed=true",
    headers: {},
    originalUrl: "/kibana/s/test-org/app/dashboards?embed=true",
    body: {},
    ...overrides,
  };
}

function makeRes(): any {
  return {
    removeHeader: jest.fn(),
    getHeader: jest.fn(),
    setHeader: jest.fn(),
  };
}

// =============================================================================
// isSpaceEscapeAttempt
// =============================================================================

describe("isSpaceEscapeAttempt", () => {
  const REALM = "my-org";

  it("returns false for a path in the correct space", () => {
    expect(isSpaceEscapeAttempt("/s/my-org/app/dashboards", REALM)).toBe(false);
  });

  it("returns false for a path in the correct space with no trailing content", () => {
    expect(isSpaceEscapeAttempt("/s/my-org", REALM)).toBe(false);
  });

  it("returns true for a path targeting a different space", () => {
    expect(isSpaceEscapeAttempt("/s/other-org/app/dashboards", REALM)).toBe(true);
  });

  it("returns true when realm is a prefix of the path's space name", () => {
    // e.g. realm='org' must not pass for '/s/org-hack/'
    expect(isSpaceEscapeAttempt("/s/my-org-hack/app/dashboards", REALM)).toBe(true);
  });

  it("returns false for global API paths that have no space prefix", () => {
    expect(isSpaceEscapeAttempt("/api/saved_objects", REALM)).toBe(false);
  });

  it("returns false for global asset paths", () => {
    expect(isSpaceEscapeAttempt("/abc123/ui/fonts/roboto.woff", REALM)).toBe(false);
  });

  it("returns false for the root path", () => {
    expect(isSpaceEscapeAttempt("/", REALM)).toBe(false);
  });
});

// =============================================================================
// computeEmbedFlags
// =============================================================================

describe("computeEmbedFlags", () => {
  it("returns all-false/true for empty roles", () => {
    expect(computeEmbedFlags([])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: false,
      showTimeFilter: true,
    });
  });

  it("shows top-menu and query-input for pla-admin", () => {
    expect(computeEmbedFlags(["pla-admin"])).toEqual<EmbedFlags>({
      showTopMenu: true,
      showQueryInput: true,
      showTimeFilter: true,
    });
  });

  it("does NOT show top-menu for pla-writer", () => {
    expect(computeEmbedFlags(["pla-writer"])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: true,
      showTimeFilter: true,
    });
  });

  it("does NOT show top-menu for pla-reader", () => {
    expect(computeEmbedFlags(["pla-reader"])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: false,
      showTimeFilter: true,
    });
  });

  it("shows query-input for epi-writer", () => {
    expect(computeEmbedFlags(["epi-writer"])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: true,
      showTimeFilter: true,
    });
  });

  it("shows query-input for epi-admin", () => {
    expect(computeEmbedFlags(["epi-admin"])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: true,
      showTimeFilter: true,
    });
  });

  it("does NOT show query-input for epi-reader", () => {
    expect(computeEmbedFlags(["epi-reader"])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: false,
      showTimeFilter: true,
    });
  });

  it("does NOT show query-input for reader-only role combination", () => {
    expect(computeEmbedFlags(["pla-reader", "epi-reader"])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: false,
      showTimeFilter: true,
    });
  });

  it("showTimeFilter is ALWAYS true regardless of roles", () => {
    for (const roles of [[], ["pla-reader"], ["epi-admin"], ["pla-admin"]]) {
      expect(computeEmbedFlags(roles).showTimeFilter).toBe(true);
    }
  });

  it("ignores unrecognised roles and applies defaults", () => {
    expect(computeEmbedFlags(["some-unknown-role"])).toEqual<EmbedFlags>({
      showTopMenu: false,
      showQueryInput: false,
      showTimeFilter: true,
    });
  });
});

// =============================================================================
// rewriteDashboardUrl
// =============================================================================

describe("rewriteDashboardUrl", () => {
  const FLAGS_NONE: EmbedFlags = { showTopMenu: false, showQueryInput: false, showTimeFilter: true };
  const FLAGS_ALL: EmbedFlags  = { showTopMenu: true,  showQueryInput: true,  showTimeFilter: true };

  it("returns non-dashboard URLs unchanged", () => {
    const url = "/s/test-org/api/saved_objects";
    expect(rewriteDashboardUrl(url, FLAGS_NONE, 60000)).toBe(url);
  });

  it("returns URLs without a query string unchanged", () => {
    const url = "/s/test-org/app/dashboards";
    expect(rewriteDashboardUrl(url, FLAGS_NONE, 60000)).toBe(url);
  });

  it("injects enforced embed params", () => {
    const url = "/s/test-org/app/dashboards?embed=true";
    const result = rewriteDashboardUrl(url, FLAGS_NONE, 60000);
    expect(result).toContain("show-top-menu=false");
    expect(result).toContain("show-query-input=false");
    expect(result).toContain("show-time-filter=true");
  });

  it("injects true values when flags are all enabled", () => {
    const url = "/s/test-org/app/dashboards?embed=true";
    const result = rewriteDashboardUrl(url, FLAGS_ALL, 60000);
    expect(result).toContain("show-top-menu=true");
    expect(result).toContain("show-query-input=true");
    expect(result).toContain("show-time-filter=true");
  });

  it("replaces client-supplied embed params — cannot be overridden from outside", () => {
    // The client tries to turn everything on; the backend must enforce its flags.
    const url =
      "/s/test-org/app/dashboards?" +
      "show-top-menu=true&show-query-input=true&show-time-filter=false&embed=true";
    const result = rewriteDashboardUrl(url, FLAGS_NONE, 60000);
    expect(result).toContain("show-top-menu=false");
    expect(result).toContain("show-query-input=false");
    expect(result).toContain("show-time-filter=true"); // always true even if client sent false
    // Ensure there is only ONE occurrence of each key (old value stripped).
    expect((result.match(/show-top-menu=/g) || []).length).toBe(1);
    expect((result.match(/show-query-input=/g) || []).length).toBe(1);
    expect((result.match(/show-time-filter=/g) || []).length).toBe(1);
  });

  it("preserves unrelated query params", () => {
    const url = "/s/test-org/app/dashboards?embed=true&_g=(time:(from:now-1h,to:now))";
    const result = rewriteDashboardUrl(url, FLAGS_NONE, 60000);
    expect(result).toContain("embed=true");
    expect(result).toContain("_g=");
  });

  it("injects refreshInterval into existing _g param", () => {
    const url = "/s/test-org/app/dashboards?embed=true&_g=(time:(from:now-1h,to:now))";
    const result = rewriteDashboardUrl(url, FLAGS_NONE, 30000);
    expect(result).toMatch(/refreshInterval:\(pause:!f,value:30000\)/);
  });

  it("updates an existing refreshInterval in _g param", () => {
    const url =
      "/s/test-org/app/dashboards?embed=true" +
      "&_g=(refreshInterval:(pause:!t,value:0),time:(from:now-1h,to:now))";
    const result = rewriteDashboardUrl(url, FLAGS_NONE, 60000);
    expect(result).toMatch(/refreshInterval:\(pause:!f,value:60000\)/);
    // old value must not remain
    expect(result).not.toMatch(/refreshInterval:\(pause:!t,value:0\)/);
  });

  it("uses pause:!t when refreshInterval is 0 (paused)", () => {
    const url = "/s/test-org/app/dashboards?embed=true&_g=(time:(from:now-1h,to:now))";
    const result = rewriteDashboardUrl(url, FLAGS_NONE, 0);
    expect(result).toMatch(/refreshInterval:\(pause:!t,value:0\)/);
  });
});

// =============================================================================
// KibanaProxyService.handle() — space-escape and path enforcement
// =============================================================================

describe("KibanaProxyService.handle() – space & path guards", () => {
  let service: KibanaProxyService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getClientRoles as jest.Mock).mockReturnValue([]);
    (decodeJwt as jest.Mock).mockReturnValue({});
    service = new KibanaProxyService();
  });

  it("throws AuthorizationError when path targets a different space", () => {
    const req = makeReq({ path: "/s/evil-space/app/dashboards" });
    expect(() => service.handle(req, makeRes())).toThrow(AuthorizationError);
    expect(() => service.handle(req, makeRes())).toThrow("Direct space access blocked");
  });

  it("throws AuthorizationError when path is a prefix-match escape attempt", () => {
    // /s/test-org-hack/ must NOT be allowed just because it starts with 'test-org'
    const req = makeReq({ path: "/s/test-org-hack/app/dashboards" });
    expect(() => service.handle(req, makeRes())).toThrow(AuthorizationError);
  });

  it("allows requests to the org's own dashboard app", () => {
    const req = makeReq({ path: "/s/test-org/app/dashboards" });
    expect(() => service.handle(req, makeRes())).not.toThrow();
  });

  it("allows API paths within the org space", () => {
    const req = makeReq({ path: "/s/test-org/api/saved_objects" });
    expect(() => service.handle(req, makeRes())).not.toThrow();
  });

  it("allows internal paths within the org space", () => {
    const req = makeReq({ path: "/s/test-org/internal/something" });
    expect(() => service.handle(req, makeRes())).not.toThrow();
  });

  it("allows global asset paths (no space prefix)", () => {
    const req = makeReq({ path: "/abc123/ui/fonts/roboto.woff" });
    expect(() => service.handle(req, makeRes())).not.toThrow();
  });

  it("blocks non-dashboard, non-asset paths within the org space", () => {
    const req = makeReq({ path: "/s/test-org/app/discover" });
    expect(() => service.handle(req, makeRes())).toThrow(AuthorizationError);
    expect(() => service.handle(req, makeRes())).toThrow("Only dashboards are allowed");
  });

  it("blocks access to management app within the org space", () => {
    const req = makeReq({ path: "/s/test-org/app/management" });
    expect(() => service.handle(req, makeRes())).toThrow(AuthorizationError);
  });
});

// =============================================================================
// KibanaProxyService.handle() — embed-flag injection per role
// =============================================================================

describe("KibanaProxyService.handle() – embed flag enforcement", () => {
  let service: KibanaProxyService;

  beforeEach(() => {
    jest.clearAllMocks();
    (decodeJwt as jest.Mock).mockReturnValue({ sub: "user-1" });
    service = new KibanaProxyService();
  });

  function handleAndGetFlags(roles: string[], token = "Bearer fake.jwt.token"): EmbedFlags {
    (getClientRoles as jest.Mock).mockReturnValue(roles);
    const req = makeReq({
      path: "/s/test-org/app/dashboards",
      headers: { authorization: token },
    });
    service.handle(req, makeRes());
    return (req as any)._kibanaEmbed as EmbedFlags;
  }

  it("show-time-filter is ALWAYS true regardless of role", () => {
    expect(handleAndGetFlags([]).showTimeFilter).toBe(true);
    expect(handleAndGetFlags(["pla-admin"]).showTimeFilter).toBe(true);
    expect(handleAndGetFlags(["pla-reader"]).showTimeFilter).toBe(true);
    expect(handleAndGetFlags(["epi-writer"]).showTimeFilter).toBe(true);
  });

  it("show-top-menu is false for no roles", () => {
    expect(handleAndGetFlags([]).showTopMenu).toBe(false);
  });

  it("show-top-menu is false for pla-reader", () => {
    expect(handleAndGetFlags(["pla-reader"]).showTopMenu).toBe(false);
  });

  it("show-top-menu is false for pla-writer", () => {
    expect(handleAndGetFlags(["pla-writer"]).showTopMenu).toBe(false);
  });

  it("show-top-menu is false for epi-admin (non-pla-admin)", () => {
    expect(handleAndGetFlags(["epi-admin"]).showTopMenu).toBe(false);
  });

  it("show-top-menu is TRUE only for pla-admin", () => {
    expect(handleAndGetFlags(["pla-admin"]).showTopMenu).toBe(true);
  });

  it("show-query-input is false for no roles", () => {
    expect(handleAndGetFlags([]).showQueryInput).toBe(false);
  });

  it("show-query-input is false for pla-reader", () => {
    expect(handleAndGetFlags(["pla-reader"]).showQueryInput).toBe(false);
  });

  it("show-query-input is false for epi-reader", () => {
    expect(handleAndGetFlags(["epi-reader"]).showQueryInput).toBe(false);
  });

  it("show-query-input is TRUE for pla-writer", () => {
    expect(handleAndGetFlags(["pla-writer"]).showQueryInput).toBe(true);
  });

  it("show-query-input is TRUE for pla-admin", () => {
    expect(handleAndGetFlags(["pla-admin"]).showQueryInput).toBe(true);
  });

  it("show-query-input is TRUE for epi-writer", () => {
    expect(handleAndGetFlags(["epi-writer"]).showQueryInput).toBe(true);
  });

  it("show-query-input is TRUE for epi-admin", () => {
    expect(handleAndGetFlags(["epi-admin"]).showQueryInput).toBe(true);
  });

  it("client cannot override show-top-menu=true by injecting it in the URL", () => {
    // Even if the frontend appends show-top-menu=true, a reader must still see false.
    (getClientRoles as jest.Mock).mockReturnValue(["pla-reader"]);
    const req = makeReq({
      path: "/s/test-org/app/dashboards",
      url: "/s/test-org/app/dashboards?show-top-menu=true&embed=true",
      headers: { authorization: "Bearer fake.jwt.token" },
    });
    service.handle(req, makeRes());
    const flags: EmbedFlags = (req as any)._kibanaEmbed;
    expect(flags.showTopMenu).toBe(false);
  });

  it("client cannot force show-time-filter=false", () => {
    (getClientRoles as jest.Mock).mockReturnValue([]);
    const req = makeReq({
      path: "/s/test-org/app/dashboards",
      url: "/s/test-org/app/dashboards?show-time-filter=false&embed=true",
      headers: { authorization: "Bearer fake.jwt.token" },
    });
    service.handle(req, makeRes());
    const flags: EmbedFlags = (req as any)._kibanaEmbed;
    expect(flags.showTimeFilter).toBe(true);
  });
});

// =============================================================================
// KibanaProxyService.handle() — dev mode (verifyToken disabled)
// =============================================================================

describe("KibanaProxyService.handle() – dev mode (verifyToken disabled)", () => {
  let service: KibanaProxyService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Disable token verification — mimic local dev environment.
    (Environment as any).verifyToken = false;
    service = new KibanaProxyService();
  });

  afterEach(() => {
    // Restore for other test suites.
    (Environment as any).verifyToken = true;
  });

  it("does NOT call decodeJwt when verifyToken is false", () => {
    const req = makeReq({
      path: "/s/test-org/app/dashboards",
      headers: { authorization: "Bearer some.token" },
    });
    service.handle(req, makeRes());
    expect(decodeJwt).not.toHaveBeenCalled();
  });

  it("falls back to env-configured values for topMenu and queryInput", () => {
    // Env mock has topMenu=false, queryInput=false — those should be used.
    const req = makeReq({ path: "/s/test-org/app/dashboards", headers: {} });
    service.handle(req, makeRes());
    const flags: EmbedFlags = (req as any)._kibanaEmbed;
    expect(flags.showTopMenu).toBe(false);
    expect(flags.showQueryInput).toBe(false);
  });

  it("showTimeFilter is still true in dev mode regardless of env", () => {
    const req = makeReq({ path: "/s/test-org/app/dashboards", headers: {} });
    service.handle(req, makeRes());
    expect(((req as any)._kibanaEmbed as EmbedFlags).showTimeFilter).toBe(true);
  });
});
