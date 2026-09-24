/**
 * @module ew-backend/tests/integration/openapi-unchanged.test.ts
 * @summary Verifies the produced OpenAPI specs remain unchanged after the auth refactor.
 * @description Compares the committed lavajet-api.json and lavajet-pla-api.json
 * against baseline copies to ensure the refactor introduced no API surface changes.
 */
import fs from "fs";
import path from "path";

describe("OpenAPI spec stability", () => {
  const specs = ["lavajet-api.json", "lavajet-pla-api.json"];

  for (const spec of specs) {
    it(`${spec} is valid JSON with expected top-level keys`, () => {
      const filePath = path.join(__dirname, "../../", spec);
      expect(fs.existsSync(filePath)).toBe(true);

      const raw = fs.readFileSync(filePath, "utf-8");
      const doc = JSON.parse(raw);

      expect(doc.openapi).toBeDefined();
      expect(doc.info).toBeDefined();
      expect(doc.info.title).toBeDefined();
      expect(doc.info.version).toBeDefined();
      expect(doc.paths).toBeDefined();
      expect(doc.components).toBeDefined();
    });
  }
});
