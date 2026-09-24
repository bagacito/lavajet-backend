/**
 * Unit tests for the public-api fallback logger consumer (`logPublicFallbackEvent`).
 *
 * Acceptance criterion 2 requires that the `log.for(...)` binding added by
 * SAA-1121 propagates to the application points that actually emit the binding.
 * This suite proves the per-ip binding — `log.for({ ip: clientIp })` — is issued
 * for every public resolver branch, and that the log call carries the resolver
 * event and URI so the binding is observable downstream.
 *
 * These are plain unit tests (not Xray-reportable), so `it()`/`expect()` are used.
 */

jest.mock("../../src/utils/environment", () => ({
  Environment: {
    lavajet: { port: 8080, protocol: "https", host: "lavajet.test.internal" },
  },
}));

// logUtils.ts imports only these two enums from lavajet-toolkit; mocking the package
// avoids pulling the heavy @decaf-ts/for-fabric → @hyperledger/fabric-gateway
// ESM chain that ts-jest cannot transform in this CJS test run.
jest.mock("@bagacito/lavajet-toolkit", () => ({
  PlaEvents: { SCAN: "SCAN", METADATA: "METADATA", OWNER: "OWNER" },
  EventResolutionStatus: { SUCCESS: "SUCCESS", MISS: "MISS", FAIL: "FAIL" },
}));

import { logPublicFallbackEvent } from "../../src/api/public/logUtils";

describe("logPublicFallbackEvent binding consumer", () => {
  function mockLog() {
    const child = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };
    const log = { for: jest.fn(() => child) };
    return { log, child };
  }

  it("binds the client ip onto the log via .for for /public/owner routes", () => {
    const { log, child } = mockLog();
    logPublicFallbackEvent("/public/owner/123?x=1", true, "1.2.3.4", log as any);
    expect(log.for).toHaveBeenCalledWith({ ip: "1.2.3.4" });
    expect(child.info).toHaveBeenCalledWith(
      expect.stringContaining("RESOLVER pharmaledger")
    );
  });

  it("binds the client ip onto the log via .for for /public/metadata routes", () => {
    const { log, child } = mockLog();
    logPublicFallbackEvent(
      "/public/metadata/P/B?some=param",
      true,
      "10.0.0.9",
      log as any
    );
    expect(log.for).toHaveBeenCalledWith({ ip: "10.0.0.9" });
    expect(child.info).toHaveBeenCalledWith(
      expect.stringContaining("RESOLVER pharmaledger")
    );
  });

  it("binds the client ip onto the log via .for for /public/leaflet routes", () => {
    const { log, child } = mockLog();
    logPublicFallbackEvent("/public/leaflet", false, "172.16.0.1", log as any);
    expect(log.for).toHaveBeenCalledWith({ ip: "172.16.0.1" });
    expect(child.info).toHaveBeenCalledWith(
      expect.stringContaining("RESOLVER pharmaledger")
    );
    expect(child.info).toHaveBeenCalledWith(
      expect.stringContaining("FAIL")
    );
  });

  it("does not bind or log for a path that does not match a public resolver", () => {
    const { log, child } = mockLog();
    logPublicFallbackEvent("/public/unknown/path", true, "5.5.5.5", log as any);
    expect(log.for).not.toHaveBeenCalled();
    expect(child.info).not.toHaveBeenCalled();
  });
});
