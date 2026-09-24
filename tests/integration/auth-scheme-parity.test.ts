/**
 * @module ew-backend/tests/integration/auth-scheme-parity.test.ts
 * @summary Validates that the generated auth scheme remains stable across the
 * app.module and app-pla.module entrypoints.
 * @description Compares the committed OpenAPI documents produced from both
 * entrypoints and ensures matching routes keep the same `security` metadata.
 */
import fs from "fs";
import path from "path";

type OpenApiDoc = {
  paths?: Record<string, Record<string, { security?: unknown }>>;
  components?: {
    securitySchemes?: Record<string, unknown>;
  };
};

function loadSpec(fileName: string): OpenApiDoc {
  const filePath = path.join(__dirname, "../../", fileName);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as OpenApiDoc;
}

function routeSecurityMap(doc: OpenApiDoc) {
  const routes = new Map<string, string>();
  for (const [route, methods] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods)) {
      routes.set(
        `${method.toUpperCase()} ${route}`,
        JSON.stringify(operation.security ?? null)
      );
    }
  }
  return routes;
}

describe("auth scheme parity", () => {
  const appSpec = loadSpec("lavajet-api.json");
  const plaSpec = loadSpec("lavajet-pla-api.json");

  it("keeps the same security scheme definitions", () => {
    expect(appSpec.components?.securitySchemes).toEqual(
      plaSpec.components?.securitySchemes
    );
  });

  it("keeps matching routes on the same security metadata", () => {
    const appRoutes = routeSecurityMap(appSpec);
    const plaRoutes = routeSecurityMap(plaSpec);

    for (const [route, security] of appRoutes.entries()) {
      if (!plaRoutes.has(route)) continue;
      expect(plaRoutes.get(route)).toBe(security);
    }
  });
});
