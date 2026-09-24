# Design Principles

1. **One shell, two products.** The EW (MAH) and PLA (Admin) builds share the
   same bootstrap, request pipeline and auto-controller machinery; the only
   difference is which application module is compiled. The Dockerfile swaps
   `app-pla.module.ts` over `app.module.ts` before the PLA build
   (`Dockerfile:44-45`), so PLA-specific behaviour is additive, not a fork.

2. **The toolkit owns the domain, the backend owns the wiring.** Models,
   repositories, services, contracts and flavours live in
   `@bagacito/lavajet-toolkit`. `ew-backend` selects flavours, registers
   adapters, applies operation blocks and exposes controllers. No domain rule is
   re-implemented in the backend.

3. **Models generate their own controllers.** `DecafModule.forRootAsync({ autoControllers: true })`
   derives CRUD, pagination, statement and query routes from each registered model
   (`src/app.module.ts:224`, `src/app-pla.module.ts:236`). Hand-written
   controllers are reserved for routes the auto-controller cannot express:
   integration legacy routes, public read routes, infrastructure orchestration,
   leaflet-resolver operations, Kibana proxying and root health.

4. **Ledger-first writes, controlled mutability.** Every model that is written to
   the ledger blocks the operations it must never allow. Products, batches,
   markets, strengths, images and leaflet files are append/update-only (no delete);
   task and audit records are immutable. Blocks are declared next to the model
   registration in the application module so the policy is visible in one place
   (`src/app.module.ts:64-119`).

5. **Security is contextual, and per-route.** Authentication is enforced by
   `FabricKeycloakAuthHandler` through the global `AuthInterceptor`
   (`src/auth/keycloakModule.ts`). Routes opt out explicitly with `@Public()`, and
   routes that must not touch Fabric opt out of identity re-enrolment with
   `@SkipFabricIdentity()`. Public writes to the leaflet `external` route are
   re-routed through the authenticated path because they submit transactions.

6. **Configuration is declared, not hard-coded.** Every environment value is read
   through the accumulated decaf `Environment` object
   (`src/utils/environment.ts`, `src/utils/pla-environment.ts`). No literal
   credentials or endpoints are baked into controllers. The only direct
   `process.env` reads are the indexed Fabric MSP maps and the local/CLI escape
   hatches, which cannot be expressed as a decaf path.

7. **The OpenAPI document is generated, then reviewed.** Swagger is enabled from
   the same environment (`src/main.ts:58`) and the API documents are exported with
   `decaf nest export-api`. The checked-in JSON is treated as a generated artifact
   and refreshed when controllers change (see
   [Endpoints](LAVAJET_05_0_Endpoints.md)).

8. **Testability.** Each route family has a matching integration/e2e suite under
   `tests/`, and the coverage run is wired through
   `workdocs/reports/jest.coverage.config.ts` (`npm run coverage`). The board's
   Tester role owns test authoring; this specification documents behaviour only.
