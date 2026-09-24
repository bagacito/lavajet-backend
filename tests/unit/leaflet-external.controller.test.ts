/**
 * Unit tests for the LAVAJET-1016 external-document routes on the public leaflet
 * controller: GET (stream) and POST (upload, base64 body), each with the
 * batch-less fallback route, and the `default` sentinel handling for the
 * optional leaflet coordinates (batch / epiType / market).
 *
 * The leaflet-mutating DELETE route is intentionally not exposed - a leaflet is
 * only written through the Leaflet create/update API - so it is not covered
 * here any more.
 *
 * Plain unit tests -> it()/expect().
 */

jest.mock("../../src/utils/environment", () => ({
  Environment: {
    throttling: { publicTtlMs: 60000, publicLimit: 100 },
    lavajet: { port: 8080, protocol: "https", host: "lavajet.test.internal" },
  },
}));

// The controller imports Leaflet/LeafletService from the toolkit package;
// mocking the package avoids pulling the heavy @decaf-ts/for-fabric ->
// @hyperledger/fabric-gateway ESM chain that ts-jest cannot transform here.
jest.mock("@bagacito/lavajet-toolkit", () => ({
  Leaflet: class Leaflet {},
  LeafletService: class LeafletService {},
}));

jest.mock("../../src/api/public/logUtils", () => ({
  logPublicFallbackEvent: jest.fn(),
}));

import { NotFoundError } from "@decaf-ts/db-decorators";
import { LeafletController } from "../../src/api/public/leaflet/leaflet.controller";
import { logPublicFallbackEvent } from "../../src/api/public/logUtils";

describe("LeafletController external document routes", () => {
  let controller: LeafletController;
  let service: any;
  let clientContext: any;
  let overrides: any;

  beforeEach(() => {
    overrides = {};
    service = {
      externalDocumentContent: jest.fn(),
      uploadExternalDocument: jest.fn(),
      for: jest.fn(),
    };
    // `for(overrides)` returns the same service so the controller's
    // `.for(overrides).uploadExternalDocument(...)` chain resolves to the
    // mocked method above.
    service.for.mockReturnValue(service);
    clientContext = {
      toOverrides: jest.fn(() => overrides),
    };
    controller = new LeafletController(service, clientContext);
    const logged: any = { ctxArgs: [], log: { info: jest.fn() } };
    logged.for = jest.fn(() => logged);
    jest.spyOn(controller as any, "logCtx").mockResolvedValue(logged);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  function makeRes() {
    return {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  }

  describe("GET external/:gtin/:batch/:epiType/:market/:lang/:fileName", () => {
    it("streams the document with the correct content-type", async () => {
      const res = makeRes();
      (async function* () {
        yield new Uint8Array([1, 2, 3]);
      })();
      service.externalDocumentContent.mockResolvedValue({
        stream: (async function* () {
          yield new Uint8Array([1, 2, 3]);
        })(),
        contentType: "application/pdf",
        entry: { fileName: "a.pdf" },
      });

      await controller.externalDocumentContent(
        "gtin1",
        "BATCH",
        "leaflet",
        "pt",
        "en",
        "a.pdf",
        res as any,
        "1.2.3.4",
        { url: "/leaflet/external/gtin1/BATCH/leaflet/en/pt/a.pdf" } as any
      );

      expect(service.externalDocumentContent).toHaveBeenCalledWith(
        "gtin1",
        "BATCH",
        "leaflet",
        "en",
        "pt",
        "a.pdf",
        ...([] as any[])
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/pdf"
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringContaining("a.pdf")
      );
      expect(res.write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
      expect(res.end).toHaveBeenCalled();
    });

    it("maps the 'default' batch to undefined before resolving the leaflet", async () => {
      const res = makeRes();
      service.externalDocumentContent.mockResolvedValue({
        stream: (async function* () {})(),
        contentType: "application/pdf",
        entry: { fileName: "a.pdf" },
      });

      await controller.externalDocumentContent(
        "gtin1",
        "default",
        "leaflet",
        "pt",
        "en",
        "a.pdf",
        res as any,
        "1.2.3.4",
        { url: "/x" } as any
      );

      expect(service.externalDocumentContent).toHaveBeenCalledWith(
        "gtin1",
        undefined,
        "leaflet",
        "en",
        "pt",
        "a.pdf",
        ...([] as any[])
      );
    });

    it("returns 404 for a non-owned / unknown document", async () => {
      const res = makeRes();
      service.externalDocumentContent.mockRejectedValue(
        new NotFoundError('External document "nope.pdf" is not owned')
      );

      await controller.externalDocumentContent(
        "gtin1",
        "BATCH",
        "leaflet",
        "pt",
        "en",
        "nope.pdf",
        res as any,
        "1.2.3.4",
        { url: "/leaflet/external/.../nope.pdf" } as any
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 })
      );
      expect(logPublicFallbackEvent).toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });
  });

  describe("GET external/:gtin/:epiType/:market/:lang/:fileName (no batch)", () => {
    it("resolves the leaflet with no batch at all", async () => {
      const res = makeRes();
      service.externalDocumentContent.mockResolvedValue({
        stream: (async function* () {})(),
        contentType: "image/png",
        entry: { fileName: "a.png" },
      });

      await controller.externalDocumentContentNoBatch(
        "gtin1",
        "leaflet",
        "default",
        "en",
        "a.png",
        res as any,
        "1.2.3.4",
        { url: "/x" } as any
      );

      expect(service.externalDocumentContent).toHaveBeenCalledWith(
        "gtin1",
        undefined,
        "leaflet",
        "en",
        undefined,
        "a.png",
        ...([] as any[])
      );
    });
  });

  describe("optional leaflet coordinates", () => {
    it.each([
      ["default", undefined],
      ["DEFAULT", undefined],
      ["", undefined],
      ["undefined", undefined],
      ["null", undefined],
      ["-", undefined],
      ["us", "us"],
      [" us ", "us"],
    ])("maps the market segment %p to %p", async (segment, expected) => {
      const res = makeRes();
      service.externalDocumentContent.mockResolvedValue({
        stream: (async function* () {})(),
        contentType: "application/pdf",
        entry: { fileName: "a.pdf" },
      });

      await controller.externalDocumentContent(
        "gtin1",
        "default",
        "leaflet",
        segment as string,
        "en",
        "a.pdf",
        res as any,
        "1.2.3.4",
        { url: "/x" } as any
      );

      expect(service.externalDocumentContent).toHaveBeenCalledWith(
        "gtin1",
        undefined,
        "leaflet",
        "en",
        expected,
        "a.pdf",
        ...([] as any[])
      );
    });
  });

  describe("POST external/:gtin/:batch/:epiType/:market/:lang", () => {
    it("uploads the base64 body and returns the ExternalFile reference", async () => {
      const entry = {
        fileName: "new.pdf",
        contentType: "application/pdf",
        size: 4,
        storageKey: "gtin1/BATCH/leaflet/pt/en/new.pdf",
        uploadedAt: "2026-01-01T00:00:00.000Z",
      };
      service.uploadExternalDocument.mockResolvedValue(entry);

      const result = await controller.uploadExternalDocument(
        "gtin1",
        "BATCH",
        "leaflet",
        "pt",
        "en",
        {
          fileName: "new.pdf",
          contentType: "application/pdf",
          size: 4,
          dataBase64: Buffer.from([1, 2, 3, 4]).toString("base64"),
        } as any
      );

      expect(service.uploadExternalDocument).toHaveBeenCalledWith(
        "gtin1",
        "BATCH",
        "leaflet",
        "en",
        "pt",
        expect.objectContaining({
          fileName: "new.pdf",
          contentType: "application/pdf",
          size: 4,
          data: expect.any(Buffer),
        }),
        ...([] as any[])
      );
      // the upload never touches the ledger: the reference is what the Leaflet
      // create/update then persists
      expect(result).toBe(entry);
      expect(clientContext.toOverrides).toHaveBeenCalled();
      expect(service.for).toHaveBeenCalledWith(overrides);
    });

    it("maps every 'default' coordinate to undefined before uploading", async () => {
      service.uploadExternalDocument.mockResolvedValue({});

      await controller.uploadExternalDocument(
        "gtin1",
        "default",
        "default",
        "default",
        "en",
        {
          fileName: "a.mp4",
          size: 1,
          dataBase64: Buffer.from([5]).toString("base64"),
        } as any
      );

      expect(service.uploadExternalDocument).toHaveBeenCalledWith(
        "gtin1",
        undefined,
        undefined,
        "en",
        undefined,
        expect.objectContaining({ fileName: "a.mp4" }),
        ...([] as any[])
      );
    });
  });

  describe("POST external/:gtin/:epiType/:market/:lang (no batch)", () => {
    it("uploads for a product-scoped leaflet", async () => {
      service.uploadExternalDocument.mockResolvedValue({});

      await controller.uploadExternalDocumentNoBatch(
        "gtin1",
        "leaflet",
        "us",
        "en",
        {
          fileName: "a.png",
          size: 2,
          dataBase64: Buffer.from([1, 2]).toString("base64"),
        } as any
      );

      expect(service.uploadExternalDocument).toHaveBeenCalledWith(
        "gtin1",
        undefined,
        "leaflet",
        "en",
        "us",
        expect.objectContaining({ fileName: "a.png" }),
        ...([] as any[])
      );
    });
  });

  describe("leaflet-mutating routes", () => {
    it("does not expose an attach/detach route on the controller", () => {
      // writes go through the Leaflet create/update API only
      expect((controller as any).addExternalDocument).toBeUndefined();
      expect((controller as any).removeExternalDocument).toBeUndefined();
    });
  });
});
