/**
 * SSE fan-out (backend => frontend) without the real application.
 *
 * Mirrors decaf's for-nest `events-subscriptions` / `sse-concurrency-regression`
 * suites, but with ew-backend's events configuration and auth wiring: several
 * concurrent HTTP adapters observe the same table, each performs creates,
 * updates and deletes against the dedicated backend, and every adapter must
 * receive one — and only one — copy of every event.
 *
 * Requires the decaf releases carrying the SSE fixes (for-http: AuthHandler on
 * model-less routes, header resolver, reconnection; for-nest: per-client
 * fingerprints, no single-stream claim in broadcast mode, `authenticate`).
 */
import {
  bootEventsBackend,
  Consumer,
  ConsumerOptions,
  delay,
  eventKey,
  EventsBackend,
  expectExactlyOnce,
  isListening,
  makeConsumer,
  runConcurrentOperations,
  serverStreams,
  SseOther,
  SseProbe,
  tokenFor,
  waitFor,
} from "./sse-harness";

jest.setTimeout(60000);

const CONSUMERS = 5;
const ROUNDS = 3;

/**
 * Connects the consumers and waits until the backend really accepted their
 * streams (`streams` = expected number of distinct SSE connections).
 */
async function connectAll(
  options: ConsumerOptions[],
  streams = options.length
): Promise<Consumer[]> {
  const consumers = options.map((o) => makeConsumer(o));
  const ready = await waitFor(
    () => consumers.every(isListening) && serverStreams() === streams
  );
  expect({ ready, streams: serverStreams() }).toEqual({ ready: true, streams });
  return consumers;
}

async function shutdownAll(consumers: Consumer[]): Promise<void> {
  await Promise.all(consumers.map((c) => c.shutdown()));
  await waitFor(() => serverStreams() === 0, 5000);
}

describe("SSE events fan-out — broadcast mode (ew-backend's configuration)", () => {
  let backend: EventsBackend;
  let consumers: Consumer[] = [];

  beforeAll(async () => {
    backend = await bootEventsBackend();
  });

  afterEach(async () => {
    await shutdownAll(consumers);
    consumers = [];
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("distinct users, each on its own connection, each get every event exactly once", async () => {
    consumers = await connectAll(
      Array.from({ length: CONSUMERS }, (_, idx) => ({
        host: backend.host,
        name: `user-${idx}`,
        token: tokenFor(`user-${idx}@pla.test`),
      }))
    );
    const expected = await runConcurrentOperations(consumers, ROUNDS);
    await expectExactlyOnce(consumers, expected);
  });

  it("the same user on several tabs/devices: every tab gets every event exactly once", async () => {
    const token = tokenFor("same.user@pla.test");
    consumers = await connectAll(
      Array.from({ length: CONSUMERS }, (_, idx) => ({
        host: backend.host,
        name: `tab-${idx}`,
        token,
      }))
    );
    const expected = await runConcurrentOperations(consumers, ROUNDS);
    await expectExactlyOnce(consumers, expected);
  });

  it("several adapters sharing one connection (same JS realm) each get every event exactly once", async () => {
    const token = tokenFor("shared.realm@pla.test");
    consumers = await connectAll(
      Array.from({ length: CONSUMERS }, (_, idx) => ({
        host: backend.host,
        name: `shared-${idx}`,
        token,
        ownConnection: false,
      })),
      1
    );
    const expected = await runConcurrentOperations(consumers, ROUNDS);
    await expectExactlyOnce(consumers, expected);
  });

  it("a client that stops observing and observes again (page navigation) resumes without duplicates", async () => {
    const token = tokenFor("navigating.user@pla.test");
    consumers = await connectAll([
      { host: backend.host, name: "nav", token },
    ]);
    const [client] = consumers;

    // leaving the page: last observer goes away => the stream is closed
    client.stop();
    // entering the next page: new observer on the same adapter => new stream
    const events: string[] = [];
    client.stop = client.service.observe({
      refresh: async (table: any, op: any, id: any) => {
        events.push(`${typeof table === "string" ? table : table?.name}:${op}:${id}`);
      },
    } as any);

    // events emitted while the new stream is still connecting are not
    // replayed (plain SSE); probe until the new stream is live
    const started = Date.now();
    for (let probe = 0; !events.length && Date.now() - started < 5000; probe++) {
      await client.service.create(
        new SseProbe({ id: `nav-probe-${probe}`, label: "probe", revision: 0 })
      );
      await waitFor(() => events.length > 0, 250);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(serverStreams()).toBe(1);

    const id = `nav-${Math.random().toString(36).slice(2, 8)}`;
    await client.service.create(new SseProbe({ id, label: "nav", revision: 0 }));
    await waitFor(() => events.includes(`${SseProbe.name}:create:${id}`), 3000);
    await delay(300);
    expect(events.filter((e) => e === `${SseProbe.name}:create:${id}`)).toHaveLength(1);
    expect(new Set(events).size).toBe(events.length);
  });
});

describe("SSE events fan-out — subscription mode (subscribe/unsubscribe)", () => {
  let backend: EventsBackend;
  let consumers: Consumer[] = [];

  beforeAll(async () => {
    backend = await bootEventsBackend({ subscriptionMode: true });
  });

  afterEach(async () => {
    await shutdownAll(consumers);
    consumers = [];
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("clients observing the same table each get every event exactly once; others get none", async () => {
    const token = tokenFor("subscriber@pla.test");
    const probes = await connectAll(
      Array.from({ length: CONSUMERS }, (_, idx) => ({
        host: backend.host,
        name: `sub-${idx}`,
        token,
        eventsSubscription: true,
      }))
    );
    const bystander = makeConsumer({
      host: backend.host,
      name: "sub-other-table",
      token,
      eventsSubscription: true,
      model: SseOther,
    });
    consumers = [...probes, bystander];
    expect(
      await waitFor(() => isListening(bystander) && serverStreams() === CONSUMERS + 1)
    ).toBe(true);

    const expected = await runConcurrentOperations(probes, ROUNDS);
    await expectExactlyOnce(probes, expected);
    expect(bystander.events.map(eventKey)).toEqual([]);
  });

  it("keeps the other tabs of a user subscribed when one tab leaves", async () => {
    const token = tokenFor("leaving.tab@pla.test");
    consumers = await connectAll(
      Array.from({ length: 3 }, (_, idx) => ({
        host: backend.host,
        name: `leave-${idx}`,
        token,
        eventsSubscription: true,
      }))
    );
    const [leaving, ...staying] = consumers;
    await leaving.shutdown(); // closes its stream and unsubscribes its session
    expect(await waitFor(() => serverStreams() === 2)).toBe(true);

    const expected = await runConcurrentOperations(staying, 1);
    await expectExactlyOnce(staying, expected);
  });

  it("refuses subscribe without credentials", async () => {
    const response = await fetch(`http://${backend.host}/events/subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-correlation-id": "anon" },
      body: JSON.stringify({ topics: ["SseProbe.*"] }),
    });
    expect(response.status).toBe(401);
  });
});

describe("SSE events fan-out — authentication of the events stream", () => {
  let backend: EventsBackend;

  beforeAll(async () => {
    backend = await bootEventsBackend();
  });

  afterAll(async () => {
    await backend?.close();
  });

  it("refuses a stream without credentials", async () => {
    const response = await fetch(`http://${backend.host}/events`, {
      headers: { accept: "text/event-stream" },
    });
    // Nest 11.1 (pinned here) sends the SSE headers before interceptors run, so
    // the rejection arrives as an `error` event on a stream that ends at once;
    // newer Nest answers 401 directly. Either way no stream is registered.
    if (response.status === 200) {
      const body = await Promise.race([
        response.text(),
        delay(3000).then(() => "<still open>"),
      ]);
      expect(body).toMatch(/event: error\n(?:id: \d+\n)?data: \[AuthorizationError\]\[401\]/);
    } else {
      expect(response.status).toBe(401);
      await response.body?.cancel();
    }
    expect(serverStreams()).toBe(0);
  });

  it("keeps every stream of the same user open (tabs/devices)", async () => {
    const token = tokenFor("same.auth.user@pla.test");
    const open = () =>
      fetch(`http://${backend.host}/events`, {
        headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" },
      });
    const first = await open();
    await waitFor(() => serverStreams() === 1);
    const second = await open();
    const reader = second.body!.getReader();
    try {
      const chunk = await Promise.race([
        reader.read().then((r) => Buffer.from(r.value ?? []).toString()),
        delay(1000).then(() => ""),
      ]);
      expect(chunk).not.toContain("event: error");
      expect(await waitFor(() => serverStreams() === 2)).toBe(true);
    } finally {
      await reader.cancel().catch(() => undefined);
      await first.body?.cancel();
    }
  });
});
