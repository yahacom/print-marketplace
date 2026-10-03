import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../app.js";
import {
  createQuoteService,
  type QuoteService,
  type QuoteServiceDeps,
} from "../services/quote-service.js";
import type { SliceResult } from "../services/slicer-service.js";

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const SUCCESS = {
  price: 5.7,
  timeMinutes: 90,
  filamentGrams: 50,
  breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
};
const REQUEST = JSON.stringify({ type: "quote.request", fileId: FILE_ID, filename: "model.stl" });

let app: ReturnType<typeof buildApp>;

const start = async (service: QuoteService) => {
  app = buildApp({ quoteService: service });
  await app.listen({ port: 0, host: "127.0.0.1" });
};

afterEach(async () => {
  await app.close();
});

const wsUrl = () => {
  const address = app.server.address();
  if (typeof address !== "object" || address === null) throw new Error("not listening");
  return `ws://127.0.0.1:${address.port}/api/v1/quotes`;
};

// Real WebSocket client: sends `payload` once open and resolves when the server
// closes the socket, with everything it pushed and the close code.
const askForQuote = (payload = REQUEST) =>
  new Promise<{ messages: Array<Record<string, unknown>>; closeCode: number }>(
    (resolve, reject) => {
      const socket = new WebSocket(wsUrl());
      const messages: Array<Record<string, unknown>> = [];
      socket.onopen = () => socket.send(payload);
      socket.onmessage = (event) =>
        messages.push(JSON.parse(String(event.data)) as Record<string, unknown>);
      socket.onclose = (event) => resolve({ messages, closeCode: event.code });
      socket.onerror = () => reject(new Error("socket error"));
    },
  );

// Opens a socket, sends the request, and returns the live socket.
const openAndRequest = () =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(wsUrl());
    socket.onopen = () => {
      socket.send(REQUEST);
      resolve(socket);
    };
    socket.onerror = () => reject(new Error("socket error"));
  });

const waitFor = async (condition: () => boolean) => {
  for (let i = 0; i < 300 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(condition()).toBe(true);
};

// `result` is a factory so a rejecting promise is created only when requested.
const fakeService = (result: () => Promise<unknown>) => {
  const requestQuote = vi.fn(() => ({ jobId: "job-1", promise: result() }));
  const cancelQuote = vi.fn();
  const service = { requestQuote, cancelQuote } as unknown as QuoteService;
  return { service, requestQuote, cancelQuote };
};

describe("quote WebSocket route", () => {
  it("AC-qr-1 / AC-qr-4: a real client against buildApp() gets exactly one quote.done, then a clean close", async () => {
    const { service, requestQuote } = fakeService(async () => SUCCESS);
    await start(service);

    const { messages, closeCode } = await askForQuote();

    expect(messages).toEqual([{ type: "quote.done", ...SUCCESS }]);
    expect(closeCode).toBe(1000);
    expect(requestQuote).toHaveBeenCalledWith(FILE_ID, "model.stl");
  });

  it.each([
    "quote.not_found",
    "quote.unslicable",
    "quote.exceeds_build_volume",
  ])("AC-qr-2: %s is pushed as exactly one quote.error, then a clean close", async (code) => {
    await start(fakeService(async () => ({ error: code })).service);

    const { messages, closeCode } = await askForQuote();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "quote.error", code });
    expect(typeof messages[0]?.message).toBe("string");
    expect(closeCode).toBe(1000);
  });

  it("an operational failure is pushed as quote.internal_error without leaking the cause", async () => {
    await start(fakeService(() => Promise.reject(new Error("firestore secret detail"))).service);

    const { messages } = await askForQuote();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "quote.error", code: "quote.internal_error" });
    expect(JSON.stringify(messages)).not.toContain("secret");
  });

  it.each(["not json", "{}", '{"fileId": 42}', "null"])(
    "a malformed request %j gets the same quote.not_found as a missing file",
    async (payload) => {
      // The real service with the real reader semantics: an unusable id is notFound.
      const service = createQuoteService({
        getModelPath: async () => ({ notFound: true }),
      } as unknown as QuoteServiceDeps);
      await start(service);

      const { messages } = await askForQuote(payload);

      expect(messages).toEqual([
        expect.objectContaining({ type: "quote.error", code: "quote.not_found" }),
      ]);
    },
  );

  it("AC-qr-3: over the rate limit the client gets quote.rate_limited and the service is not reached", async () => {
    const { service, requestQuote } = fakeService(async () => SUCCESS);
    await start(service);

    for (let i = 0; i < 30; i++) await askForQuote();
    expect(requestQuote).toHaveBeenCalledTimes(30);
    const { messages, closeCode } = await askForQuote();

    expect(messages).toEqual([
      expect.objectContaining({ type: "quote.error", code: "quote.rate_limited" }),
    ]);
    expect(closeCode).toBe(1000);
    expect(requestQuote).toHaveBeenCalledTimes(30);
  });

  it("serves one request per connection: a second message is ignored", async () => {
    const { service, requestQuote } = fakeService(async () => SUCCESS);
    await start(service);

    const socket = await openAndRequest();
    socket.send(REQUEST);
    await new Promise((resolve) => (socket.onclose = resolve));

    expect(requestQuote).toHaveBeenCalledTimes(1);
  });

  // AC-qr-5 / AC-qr-6 run the real quote-service over a fake queue, so the
  // close handler's effect on the queue and on Firestore is observable.
  const realServiceHarness = () => {
    let release!: (result: SliceResult) => void;
    const slicing = new Promise<SliceResult>((resolve) => (release = resolve));
    const queueCancel = vi.fn();
    const writeDraftOrder = vi.fn(async () => {});
    const cleanup = vi.fn(async () => {});
    const finished: SliceResult = {
      info: { exitCode: 0, stdout: "", stderr: "" },
      slice: { exitCode: 0, stdout: "", stderr: "" },
      gcodePath: "/tmp/out.gcode",
      timedOut: false,
      cancelled: false,
      cleanup,
    };
    const service = createQuoteService({
      getModelPath: async () => "/storage/model.stl",
      queue: { enqueue: () => ({ id: "queue-job", promise: slicing }), cancel: queueCancel },
      parse: async () => ({ kind: "stats", timeMinutes: 90, filamentGrams: 50 }),
      price: () => ({ timeCost: 3.75, materialCost: 1, margin: 0.95, totalPrice: 5.7 }),
      repository: { writeDraftOrder },
      log: { error: () => {} },
    });
    return { service, release, finished, queueCancel, writeDraftOrder, cleanup };
  };

  it("AC-qr-5: closing the socket mid-slice cancels the queued job and writes no draft", async () => {
    const harness = realServiceHarness();
    await start(harness.service);

    const socket = await openAndRequest();
    // The job is only cancellable once it has been enqueued.
    await new Promise((resolve) => setTimeout(resolve, 100));
    socket.close();
    await waitFor(() => harness.queueCancel.mock.calls.length > 0);
    // The queue answers a cancel with a cancelled result (T7/T4 contract).
    harness.release({ ...harness.finished, cancelled: true, gcodePath: null });
    await waitFor(() => harness.cleanup.mock.calls.length > 0);

    expect(harness.queueCancel).toHaveBeenCalledWith("queue-job");
    expect(harness.writeDraftOrder).not.toHaveBeenCalled();
  });

  it("AC-qr-6: closing after the quote was delivered is a harmless no-op", async () => {
    const harness = realServiceHarness();
    await start(harness.service);

    const delivered = askForQuote();
    await new Promise((resolve) => setTimeout(resolve, 100));
    harness.release(harness.finished);
    const { messages } = await delivered;
    await new Promise((resolve) => setTimeout(resolve, 100)); // let the close handler run

    expect(messages).toEqual([{ type: "quote.done", ...SUCCESS }]);
    expect(harness.queueCancel).not.toHaveBeenCalled();
    expect(harness.writeDraftOrder).toHaveBeenCalledTimes(1);
  });
});
