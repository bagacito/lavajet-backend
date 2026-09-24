# Integration test scaffolding

This folder is a staging area for generated integration tests that verify the requests
defined in `@bagacito/lavajet-backend.json` against the running Nest application.

## Workflow

1. **Bootstrap the Nest app**  
   `tests/integration/app.ts` contains a simple `getApp()` helper that boots `AppModule`.
   Tweak it as needed (mock dependencies, override providers, configure environment, etc.)
   so that the application can start inside your test environment.

2. **Generate controller suites**  
   Run `npm run generate:integration-tests` to emit one `.test.ts` file per OpenAPI tag inside
   `tests/integration/generated`. Each file imports `../openapi.helpers`, reuses `request`,
   and embeds the schema for the happy path.

3. **Fill in the placeholders**  
   The generated tests include:

   - `pathParams`, `queryParams`, and `bodyPayload` objects that default to lightweight samples.
   - A `TODO` block to document additional parameter variations and error cases.
   - A call to `resolvePath` so you can tune path parameters without touching the request logic.

   Replace the sample values with real data from your fixtures, add negative-path tests for
   validation errors, and verify error responses using the same `openApiSpec` helper.

4. **Run targeted suites**  
   Use `npm run test:integration` (or `npm run test:integration -- generated/<suite>.test.ts`) once the
   application can start and your placeholders are populated.

5. **Regenerate when OpenAPI mutates**  
   If new controllers/routes are added to the OpenAPI document, re-run the generator and merge the
   new scaffolding into your existing tests. The generator will overwrite the files under
   `tests/integration/generated`, so keep hand-edited logic in separate files or copy it into a
   committed version of the generated template.
