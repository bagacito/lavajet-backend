# Sequences

These diagrams describe the principal runtime flows. They are derived from the
controllers, interceptors and services referenced inline; the concrete contract
execution and adapter internals live in the toolkit.

## 1. Application boot

```mermaid
sequenceDiagram
  autonumber
  participant CLI as bin/cli.ts (nest boot)
  participant Main as main.ts
  participant Nest as NestFactory
  participant Auth as AuthModule
  participant Decaf as DecafModule.forRootAsync
  participant Adapters as Fabric / Nano / TypeORM
  participant Svc as Service.boot()

  CLI->>CLI: ensureMigrationLockFile() (MIGRATIONS__LOCK_FILE)
  CLI->>Main: spawn node lib/main
  Main->>Nest: create(AppModule)
  Main->>Main: body limits, CORS, URI versioning, Swagger
  Nest->>Auth: register global AuthInterceptor + ThrottlerGuard
  Nest->>Decaf: register adapters + models + autoControllers + observerOptions
  Decaf->>Adapters: instantiate and configure
  Decaf->>Svc: initialization() → Service.boot()
  Svc-->>Nest: adapters booted
  Main->>Nest: listen(LOCAL_NEST_PORT || 3000)
```

## 2. Authenticated Fabric request

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant T as ThrottlerGuard
  participant A as AuthInterceptor
  participant H as FabricKeycloakAuthHandler
  participant J as JwtService
  participant F as Fabric identity
  participant Ctrl as Controller
  participant Svc as ModelService

  C->>T: request + Bearer token
  T->>T: check default/public rate limit
  T->>A: pass
  A->>H: authenticate(context)
  H->>J: verify JWT (JWKS)
  alt VERIFY_TOKEN falsy
    H-->>A: roles only, skip Fabric identity
  else Fabric identity required
    H->>F: lookup/re-enrol identity
    F-->>H: certificate attributes (OID 1.2.3.4.5.6.7.8.1)
    H->>H: bind identity to request context
  end
  H-->>A: authorized context
  A->>Ctrl: invoke handler
  Ctrl->>Svc: repository call (FabricFlavour)
  Svc-->>Ctrl: result
  Ctrl-->>C: response (ArrayNoContent → 204 when empty)
```

## 3. Leaflet resolver task

```mermaid
sequenceDiagram
  autonumber
  participant Trigger as Cron / POST update
  participant Ctrl as LeafletResolverController
  participant R as ProductLeafletResolverService
  participant T as TaskService ("tasks")
  participant W as Worker
  participant F as Fabric

  alt Cron (RESOLVER__CRON_TIME__LONG / SHORT)
    Trigger->>R: queueUnresolvedProducts(SERVICE_ACCOUNT)
  else HTTP
    Trigger->>Ctrl: POST /leaflet-resolver/update/...
    Ctrl->>R: queueUnresolvedProducts / queueUnresolvedProductsWithoutLeaflets
    Trigger->>Ctrl: POST /leaflet-resolver/update/{gtin}
    Ctrl->>R: resolveProduct(gtin) (synchronous)
  end
  R->>T: enqueue task records
  T->>W: lease and execute
  W->>F: query/commit leaflet-resolver records
  W->>T: persist task events
  T-->>Trigger: task streamed via /events (observer SSE)
```

## 4. Public leaflet read and external document upload

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant P as Public leaflet controller
  participant B as Blob storage (S3)
  participant F as Fabric

  alt GET /public/leaflet/... (read)
    C->>P: request (throttled publicTtlMs/publicLimit)
    P->>F: read leaflet
    F-->>P: leaflet + external file references
    P-->>C: leaflet payload
  else GET /public/leaflet/external/.../{fileName} (stream)
    C->>P: request
    P->>B: fetch stored document
    B-->>P: bytes
    P-->>C: document stream
  else POST /public/leaflet/external/... (upload)
    C->>P: multipart document
    P->>P: re-route through authenticated path
    P->>B: store document (blobs.maxSize)
    P->>F: commit ExternalFile reference
    F-->>P: committed
    P-->>C: created
  end
```

## 5. PLA onboarding and deployment

```mermaid
sequenceDiagram
  autonumber
  participant Admin as PLA admin
  participant Ctrl as InfrastructurePLAController
  participant Acct as AccountService
  participant Infra as InfrastructureService
  participant KC as Keycloak
  participant KB as Kibana
  participant PG as PostgreSQL
  participant F as Fabric

  Admin->>Ctrl: POST /infrastructure/generate-certificates
  Ctrl->>Infra: generate certificates
  Infra-->>Admin: token / certificate download URL
  Admin->>Ctrl: POST /infrastructure/onboard-on-prem
  Ctrl->>Acct: create Account (PG) with Keycloak/Kibana setup config
  Acct->>KC: provision realm, clients, identity provider, users
  Acct->>KB: provision space, dashboards, users
  Acct->>PG: persist Account + AccountConfig
  Admin->>Ctrl: POST /infrastructure/deploy/{orgName}
  Ctrl->>Infra: deploy contracts (Fabric)
  Infra->>F: submit contract deployment transactions
  Admin->>Ctrl: GET /infrastructure/download/{mspId}/{token}
  Ctrl-->>Admin: certificates / contract bundle
```
