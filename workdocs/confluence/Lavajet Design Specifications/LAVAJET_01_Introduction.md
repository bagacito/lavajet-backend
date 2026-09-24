# Introduction

The Lavajet (EW) backend is the NestJS service that backs the
PharmaLedger Product Traceability Platform (Lavajet) Lavajet. It exposes the
MAH-facing APIs (product, batch, leaflet, leaflet-resolver, integration and
public read APIs) and the PLA-facing admin APIs (account onboarding, Keycloak and
Kibana provisioning, infrastructure orchestration and token management).

The service is built on `@bagacito/lavajet-toolkit`. The toolkit owns the shared domain models,
services, repositories, contracts and adapters; `ew-backend` owns the NestJS wiring,
the request pipeline, authentication, the environment configuration and the
hand-written controllers that are not generated from a model.

Two application targets are built from the same source tree:

* **EW (MAH)** — `src/app.module.ts`, the product-facing wallet used by
  Marketing Authorisation Holders.
* **PLA (Admin)** — `src/app-pla.module.ts`, the association-facing admin
  backend. It adds the `Account`, `Token`, `Counter`, Keycloak and Kibana
  configuration models, and the infrastructure controllers that onboard, claim and
  deploy organisations.

This specification mirrors the structure of the LWA design specifications but is
scoped to the backend: architecture, models/entities, endpoints, persistence,
environment and sequences. It deliberately omits a user guide because the OpenAPI
documents play that role (see the [Index](LAVAJET_00_Index.md)).

## Source layout

| Path                    | Responsibility                                                          |
|-------------------------|-------------------------------------------------------------------------|
| `src/main.ts`           | Nest bootstrap, versioning, Swagger, CORS, body limits, port.           |
| `src/bin/cli.ts`        | Decaf CLI entrypoint (`nest boot`); used by the container `ENTRYPOINT`. |
| `src/app.module.ts`     | EW application module (adapters, models, auth, Kibana, tasks).          |
| `src/app-pla.module.ts` | PLA application module; swapped over `app.module.ts` for the PLA build. |
| `src/api/**`            | Hand-written and module-level controllers.                              |
| `src/auth/**`           | JWT service, Keycloak auth handler, Keycloak module, role helpers.      |
| `src/kibana/**`         | Kibana proxy controller, middleware, session guard.                     |
| `src/interceptors/**`   | Token, server-state and deprecation interceptors.                       |
| `src/handlers/**`       | Fabric, Nano and TypeORM request transformers.                          |
| `src/utils/**`          | Environment definitions, logging, resolver tasks, JWT helpers.          |
| `src/cli-module.ts`     | Migration CLI wiring.                                                   |

## Relationship to the toolkit

`ew-backend` depends on `@bagacito/lavajet-toolkit` for the shared domain
models, services, repositories, contracts and the `Environment`/`AdminEnvironment`
configuration accumulators. Where this specification describes a model or an
auto-generated route, the definition lives in the toolkit; `ew-backend` only
registers it, flavours it and decorates it with controller configuration.
