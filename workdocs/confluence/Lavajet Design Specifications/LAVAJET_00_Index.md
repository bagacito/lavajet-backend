# EW Backend Design Specifications

This folder holds the design specification for the Lavajet (EW) backend
(`ew-backend`). It is the backend counterpart of the LWA design specification and
covers both build targets of the service:

* **EW (MAH)** — the Lavajet backend for Marketing Authorisation
  Holders, built from `src/app.module.ts`.
* **PLA (Admin)** — the PharmaLedger Association admin backend, built from
  `src/app-pla.module.ts`. The Dockerfile swaps `app-pla.module.ts` over
  `app.module.ts` before compiling the PLA image (`Dockerfile:44-45`), so the two
  targets share one entrypoint and one Nest application shell.

## Table of Contents

* [Introduction](LAVAJET_01_Introduction.md)
* [Design Principles](LAVAJET_02_Design_Principles.md)
* [Architecture](LAVAJET_03_Architecture.md)
* [Models and Entities](LAVAJET_04_Models.md)
* [Endpoints](LAVAJET_05_0_Endpoints.md)
* [Persistence](LAVAJET_05_1_Persistence.md)
* [Environment](LAVAJET_05_9_Environment.md)
* [Sequences](LAVAJET_06_Sequences.md)

## API of record

There is intentionally **no user guide** in this specification. The generated
OpenAPI documents are the API of record and stand in for one:

* [`lavajet-api.json`](../../lavajet-api.json) — EW (MAH) surface.
* [`lavajet-pla-api.json`](../../lavajet-pla-api.json) — PLA (Admin) surface.
* 
(see [Endpoints](LAVAJET_05_0_Endpoints.md)).
