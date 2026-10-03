// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestQuote } from "./quote-client.js";

class FakeWebSocket {
  static last: FakeWebSocket;
  url: string;
  sent: string[] = [];
  closeCalls = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closeCalls++;
    this.onclose?.();
  }
  open() {
    this.onopen?.();
  }
  push(body: unknown) {
    this.onmessage?.({ data: JSON.stringify(body) });
  }
}

const DONE = {
  type: "quote.done",
  price: 5.7,
  timeMinutes: 90,
  filamentGrams: 50,
  breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
};

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("connects to the quote endpoint on the page's host and sends the file-id once open", () => {
  requestQuote("file-1");
  expect(FakeWebSocket.last.url).toBe(`ws://${location.host}/api/v1/quotes`);
  expect(FakeWebSocket.last.sent).toEqual([]);

  FakeWebSocket.last.open();

  expect(JSON.parse(FakeWebSocket.last.sent[0]!)).toEqual({
    type: "quote.request",
    fileId: "file-1",
    filename: "",
  });
});

it("sends the given filename along with the file-id", () => {
  requestQuote("file-1", "part.stl");
  FakeWebSocket.last.open();

  expect(JSON.parse(FakeWebSocket.last.sent[0]!)).toEqual({
    type: "quote.request",
    fileId: "file-1",
    filename: "part.stl",
  });
});

it("resolves with the quote from quote.done", async () => {
  const { promise } = requestQuote("file-1");
  FakeWebSocket.last.open();

  FakeWebSocket.last.push(DONE);

  expect(await promise).toEqual({
    price: 5.7,
    timeMinutes: 90,
    filamentGrams: 50,
    breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
  });
});

it("rejects with a backend failure carrying the code from quote.error", async () => {
  const { promise } = requestQuote("file-1");

  FakeWebSocket.last.push({ type: "quote.error", code: "quote.unslicable", message: "raw text" });

  await expect(promise).rejects.toEqual({
    kind: "backend",
    code: "quote.unslicable",
    message: "raw text",
  });
});

it.each([
  ["a quote.done with missing fields", { type: "quote.done", price: 1 }],
  ["an unknown message type", { type: "hello" }],
])("rejects with an unknown backend code for %s", async (_name, body) => {
  const { promise } = requestQuote("file-1");

  FakeWebSocket.last.push(body);

  await expect(promise).rejects.toMatchObject({ kind: "backend", code: "unknown" });
});

it("AC-ui-4: a socket that closes before any result rejects as connection_lost", async () => {
  const { promise } = requestQuote("file-1");
  FakeWebSocket.last.open();

  FakeWebSocket.last.onclose?.();

  await expect(promise).rejects.toEqual({ kind: "connection_lost" });
});

it("a socket error rejects as connection_lost", async () => {
  const { promise } = requestQuote("file-1");

  FakeWebSocket.last.onerror?.();

  await expect(promise).rejects.toEqual({ kind: "connection_lost" });
});

it("the server closing after a result does not turn the quote into a failure", async () => {
  const { promise } = requestQuote("file-1");
  FakeWebSocket.last.push(DONE);

  FakeWebSocket.last.onclose?.();

  await expect(promise).resolves.toMatchObject({ price: 5.7 });
});

it("close() closes the socket, can be called repeatedly, and the promise never settles afterwards", async () => {
  const { promise, close } = requestQuote("file-1");
  const settled = vi.fn();
  void promise.then(settled, settled);

  expect(() => {
    close();
    close();
  }).not.toThrow();
  FakeWebSocket.last.push(DONE);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(FakeWebSocket.last.closeCalls).toBeGreaterThan(0);
  expect(settled).not.toHaveBeenCalled();
});
