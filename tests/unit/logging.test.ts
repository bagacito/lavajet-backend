import { Context } from "@decaf-ts/core";
import { Logging, LoggingMode, logParameterRegistry } from "@decaf-ts/logging";
import {
  getLoggerFor,
  registerEwLogParameters,
  configureEwLogging,
} from "../../src/utils/logging";

describe("ew-backend logger binding", () => {
  function mockLogger() {
    const child = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const log = { ...child, for: jest.fn(() => child) };
    return { log, child };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getLoggerFor", () => {
    it("binds identity/request details onto the logger", () => {
      const { log, child } = mockLogger();
      const bound = getLoggerFor(log as any, {
        ip: "1.2.3.4",
        user: "alice",
        msp: "Org1MSP",
        roles: ["admin", "writer"],
        organization: "Org1",
        sessionId: "sid-1",
        sessionType: "web",
      });
      expect(log.for).toHaveBeenCalledWith({
        ip: "1.2.3.4",
        user: "alice",
        msp: "Org1MSP",
        roles: ["admin", "writer"],
        organization: "Org1",
        sessionId: "sid-1",
        sessionType: "web",
      });
      expect(bound).toBe(child);
    });

    it("returns the same logger when no details are present", () => {
      const { log } = mockLogger();
      const bound = getLoggerFor(log as any, {});
      expect(log.for).not.toHaveBeenCalled();
      expect(bound).toBe(log);
    });

    it("extracts details from a Context via toOverrides", () => {
      const { log } = mockLogger();
      const ctx = new Context().accumulate({
        ip: "10.0.0.1",
        user: "bob",
        msp: "Org2MSP",
        roles: ["reader"],
      } as any);
      getLoggerFor(log as any, ctx);
      expect(log.for).toHaveBeenCalledWith({
        ip: "10.0.0.1",
        user: "bob",
        msp: "Org2MSP",
        roles: ["reader"],
      });
    });
  });

  describe("registerEwLogParameters", () => {
    it("registers all supported keys and is idempotent", () => {
      registerEwLogParameters();
      registerEwLogParameters();
      for (const key of [
        "ip",
        "sessionId",
        "sessionType",
        "user",
        "organization",
        "msp",
        "roles",
      ]) {
        expect(logParameterRegistry.get(key)).toBeDefined();
      }
    });
  });

  describe("configureEwLogging", () => {
    it("registers logging parameters and enforces the pattern in RAW mode", () => {
      const setConfig = jest
        .spyOn(Logging, "setConfig")
        .mockImplementation(() => undefined as any);
      Logging.setConfig({ format: LoggingMode.RAW } as any);
      configureEwLogging();
      expect(setConfig).toHaveBeenCalled();
      expect(setConfig.mock.calls[setConfig.mock.calls.length - 1][0]).toEqual(
        expect.objectContaining({ pattern: expect.any(String) })
      );
    });
  });
});
