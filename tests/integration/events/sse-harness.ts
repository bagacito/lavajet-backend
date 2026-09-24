/**
 * Infrastructure-free harness for the SSE events feed (backend => frontend).
 *
 * Boots a very small Nest application wired like ew-backend's events surface —
 * `DecafModule.forRootAsync` with ew-backend's `observerOptions` (including
 * `authenticate: true`, so the AuthInterceptor runs on the stream and on
 * subscribe/unsubscribe), and the auth module registered the way
 * `src/auth/keycloakModule.ts` does it, backed by the real `KeycloakAuthHandler`
 * base class that `FabricKeycloakAuthHandler` extends — but persisting to a
 * `RamAdapter`, so no Fabric/CouchDB/Keycloak is needed.
 * It is booted with `NestFactory` (not `@nestjs/testing`): ew-backend pins
 * `@nestjs/core` 11.1.18 while `@nestjs/testing` resolves to 11.2.x, and that
 * mix builds request-scoped controllers (such as the events controller) with no
 * constructor arguments.
 *
 * Clients are `AxiosHttpAdapter`s configured like ew-frontend's
 * `DecafAxiosHttpAdapter` (bearer token on REST calls, `eventHeaderResolver`
 * for the SSE stream, `eventsListenerPath: "/events"`).
 */
import { Global, INestApplication, Module } from "@nestjs/common";
import { APP_INTERCEPTOR, NestFactory } from "@nestjs/core";
import { Adapter, column, pk, table } from "@decaf-ts/core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - subpath export resolved at runtime
import { RamAdapter, RamFlavour } from "@decaf-ts/core/ram";
import { uses, type Constructor } from "@decaf-ts/decoration";
import { Model, model, type ModelArg } from "@decaf-ts/decorator-validation";
import { InternalError } from "@decaf-ts/db-decorators";
import {
  AUTH_HANDLER,
  AuthInterceptor,
  DecafExceptionFilter,
  DecafModule,
  type ObserverEventsOptions,
} from "@decaf-ts/for-nest";
import {
  AxiosHttpAdapter,
  RestService,
  type HttpConfig,
} from "@decaf-ts/for-http";
import { RamTransformer } from "@decaf-ts/for-http/server";
import { KeycloakAuthHandler } from "@decaf-ts/integrations/nest";
import type { AxiosRequestConfig } from "axios";

RamAdapter.decoration();
Adapter.setCurrent(RamFlavour);

@uses(RamFlavour)
@table("sse_probe")
@model()
export class SseProbe extends Model {
  @pk({ type: "String", generated: false })
  id!: string;

  @column()
  label!: string;

  @column()
  revision!: number;

  constructor(arg?: ModelArg<SseProbe>) {
    super(arg);
  }
}

@uses(RamFlavour)
@table("sse_other")
@model()
export class SseOther extends Model {
  @pk({ type: "String", generated: false })
  id!: string;

  @column()
  label!: string;

  constructor(arg?: ModelArg<SseOther>) {
    super(arg);
  }
}

/**
 * Builds an unsigned Keycloak-shaped access token. The test auth handler only
 * decodes it (like ew-backend with `verifyToken` disabled), so the signature is
 * irrelevant; what matters is the `email` claim, which becomes the request
 * `user` wherever the auth handler runs.
 */
export function tokenFor(email: string): string {
  const b64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    b64({ alg: "none", typ: "JWT" }),
    b64({
      email,
      preferred_username: email,
      aud: "bagacito",
      iss: "https://keycloak.test/realms/bagacito",
      realm_access: { roles: ["admin"] },
    }),
    "unsigned",
  ].join(".");
}

const decodingJwtService = {
  decodePayload(token: string) {
    try {
      return JSON.parse(
        Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
      );
    } catch {
      return undefined;
    }
  },
  async decodeAuthToken(token: string) {
    return decodingJwtService.decodePayload(token);
  },
};

/**
 * The real Keycloak handler (header resolution, `/public` short-circuit,
 * `user` binding into the request context) with a decode-only JWT service.
 */
class TestKeycloakAuthHandler extends KeycloakAuthHandler {
  protected override jwt(): any {
    return decodingJwtService;
  }
}

/**
 * Same registration as ew-backend's `AuthModule`. Note that Nest does not apply
 * an `APP_INTERCEPTOR` declared with `useExisting` on a request-scoped class
 * globally: only routes decorated with `@Auth` (the model controllers) run it.
 */
@Global()
@Module({
  providers: [
    AuthInterceptor,
    // same token ew-backend's AuthModule provides for `@service("jwt")`
    { provide: "jwt", useValue: decodingJwtService },
    TestKeycloakAuthHandler,
    { provide: AUTH_HANDLER, useExisting: TestKeycloakAuthHandler },
    { provide: APP_INTERCEPTOR, useExisting: AuthInterceptor },
  ],
  exports: [AUTH_HANDLER, AuthInterceptor],
})
class TestAuthModule {}

export type EventsBackend = {
  app: INestApplication;
  host: string;
  close: () => Promise<void>;
};

/**
 * Boots the dedicated events backend on an ephemeral port.
 * @param overrides - merged over ew-backend's `observerOptions` (broadcast mode,
 * authenticated, on the persistence flavour)
 */
export async function bootEventsBackend(
  overrides: Partial<ObserverEventsOptions> = {}
): Promise<EventsBackend> {
  const observerOptions: ObserverEventsOptions = {
    enableObserverEvents: true,
    observerFlavours: [RamFlavour],
    observerApiPath: "/events",
    authenticate: true,
    ...overrides,
  };
  @Module({
    imports: [
      TestAuthModule,
      await DecafModule.forRootAsync({
        conf: [[RamAdapter, {}, new RamTransformer()]],
        autoControllers: true,
        autoServices: false,
        aggregations: false,
        observerOptions,
      } as any),
    ],
  })
  class EventsBackendModule {}

  // NestFactory (not @nestjs/testing) so the DI container is exactly the
  // production one ew-backend's main.ts builds
  const app = await NestFactory.create(EventsBackendModule, { logger: false });
  app.useGlobalFilters(new DecafExceptionFilter());
  await app.init();
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  if (!address || typeof address === "string")
    throw new InternalError("Failed to resolve events backend address");
  return {
    app,
    host: `127.0.0.1:${address.port}`,
    close: async () => {
      // open SSE streams and idle keep-alive sockets would hold server.close()
      const server = app.getHttpServer();
      const reaper = setInterval(() => server.closeAllConnections?.(), 50);
      try {
        await app.close();
      } finally {
        clearInterval(reaper);
      }
    },
  };
}

/**
 * Mirrors ew-frontend's `DecafAxiosHttpAdapter`: every REST request carries the
 * user's bearer token, and the SSE stream and subscription calls get it via
 * `eventHeaderResolver`.
 */
export class FrontendLikeAdapter extends AxiosHttpAdapter {
  constructor(
    config: HttpConfig,
    alias: string,
    private readonly bearer?: string
  ) {
    super(config, alias);
  }

  override async request<V>(
    details: AxiosRequestConfig,
    ...args: any[]
  ): Promise<V> {
    const headers = Object.assign(
      {},
      details.headers || {},
      this.bearer ? { authorization: `Bearer ${this.bearer}` } : {},
      ["POST", "PUT", "PATCH"].includes(String(details.method).toUpperCase())
        ? { "Content-Type": "application/json; charset=utf-8" }
        : {}
    );
    return super.request<V>({ ...details, headers }, ...(args as []));
  }

  /** ew-frontend's create override: POST to the collection URL */
  override async create<M extends Model>(
    tableName: Constructor<M>,
    id: any,
    model: Record<string, any>,
    ...args: any[]
  ): Promise<Record<string, any>> {
    const response = await this.post<Record<string, any>>(
      this.url(tableName),
      JSON.stringify(model),
      { headers: { "Content-Type": "application/json" } },
      ...(args as [])
    );
    return response.data as Record<string, any>;
  }
}

export type ReceivedEvent = {
  table: string;
  operation: string;
  id: string;
};

export type Consumer = {
  name: string;
  adapter: FrontendLikeAdapter;
  service: RestService<SseProbe, FrontendLikeAdapter>;
  events: ReceivedEvent[];
  stop: () => void;
  shutdown: () => Promise<void>;
};

export type ConsumerOptions = {
  host: string;
  name: string;
  /** bearer token (the events API is authenticated) */
  token?: string;
  /**
   * When true the client gets its own SSE connection, like a separate browser
   * tab/device does (each JS realm has its own ServerEventConnector cache). In
   * a single Node process adapters share one connection per URL, so a distinct
   * query string on `eventsListenerPath` is used to force a separate stream.
   * Ignored in subscription mode: the dispatcher already appends its own `cid`
   * (and for-http joins `subscribe`/`unsubscribe` onto the listener path, which
   * a query string would break).
   */
  ownConnection?: boolean;
  eventsSubscription?: boolean;
  /** observed table (defaults to {@link SseProbe}) */
  model?: Constructor<Model>;
};

export function makeConsumer(options: ConsumerOptions): Consumer {
  const { host, name, token, ownConnection = true } = options;
  const eventsListenerPath =
    ownConnection && !options.eventsSubscription
      ? `/events?client=${encodeURIComponent(name)}`
      : "/events";
  const adapter = new FrontendLikeAdapter(
    {
      protocol: "http",
      host,
      eventsListenerPath,
      eventsSubscription: options.eventsSubscription,
      eventHeaderResolver: (): Record<string, string> =>
        token ? { authorization: `Bearer ${token}` } : {},
    },
    `sse-${name}`,
    token
  );
  const service = new RestService<SseProbe, FrontendLikeAdapter>(
    adapter,
    (options.model ?? SseProbe) as Constructor<SseProbe>
  );
  const events: ReceivedEvent[] = [];
  const stop = service.observe({
    refresh: async (tableName: any, operation: any, id: any) => {
      events.push({
        table: typeof tableName === "string" ? tableName : tableName?.name,
        operation: String(operation),
        id: String(id),
      });
    },
  } as any);
  return {
    name,
    adapter,
    service,
    events,
    stop,
    shutdown: async () => {
      try {
        stop();
      } catch {
        // already stopped
      }
      try {
        await adapter.shutdown();
      } catch {
        // best-effort cleanup
      }
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
  predicate: () => boolean,
  timeoutMs = 15000,
  stepMs = 25
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return true;
    await delay(stepMs);
  }
  return predicate();
}

export function isListening(consumer: Consumer): boolean {
  return Boolean((consumer.adapter as any).dispatch?.listening);
}

/**
 * Number of SSE observers the backend has registered on its persistence
 * adapter — one per accepted `/events` stream. Unlike the client's `listening`
 * flag (which for-http also sets when the stream request is rejected), this
 * proves the streams were really established.
 */
export function serverStreams(): number {
  return (Adapter.get(RamFlavour) as any)?.observerHandler?.count() ?? 0;
}

export function eventKey(event: ReceivedEvent): string {
  return `${event.table}:${event.operation}:${event.id}`;
}

/**
 * Each consumer creates, updates and deletes `rounds` records of its own, all
 * consumers running concurrently. Returns the keys of every event the backend
 * is expected to emit.
 */
export async function runConcurrentOperations(
  consumers: Consumer[],
  rounds: number
): Promise<string[]> {
  const expected: string[] = [];
  await Promise.all(
    consumers.map(async (consumer) => {
      for (let round = 0; round < rounds; round++) {
        const id = `${consumer.name}-${round}-${Math.random().toString(36).slice(2, 8)}`;
        await consumer.service.create(
          new SseProbe({ id, label: `${consumer.name} #${round}`, revision: 0 })
        );
        await consumer.service.update(
          new SseProbe({ id, label: `${consumer.name} #${round}`, revision: 1 })
        );
        await consumer.service.delete(id);
        expected.push(
          `${SseProbe.name}:create:${id}`,
          `${SseProbe.name}:update:${id}`,
          `${SseProbe.name}:delete:${id}`
        );
      }
    })
  );
  return expected;
}

/**
 * Asserts every consumer got every expected event exactly once (no loss, no
 * duplicates), after a grace period that lets late duplicates show up.
 */
export async function expectExactlyOnce(
  consumers: Consumer[],
  expected: string[],
  timeoutMs = 20000
): Promise<void> {
  await waitFor(
    () => consumers.every((c) => c.events.length >= expected.length),
    timeoutMs
  );
  await delay(500);
  const expectedSorted = [...expected].sort();
  for (const consumer of consumers) {
    const received = consumer.events.map(eventKey).sort();
    expect({ consumer: consumer.name, received }).toEqual({
      consumer: consumer.name,
      received: expectedSorted,
    });
  }
}
