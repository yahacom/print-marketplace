// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { App, transitions } from "./app.js";
import type { QuoteFailure } from "./errors.js";
import type { QuoteDone, QuoteRequest } from "./quote-client.js";

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  responseText = "";
  timeout = 0;
  upload = { onprogress: null as ((event: unknown) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open() {}
  send() {}
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

const QUOTE: QuoteDone = {
  price: 5.7,
  timeMinutes: 90,
  filamentGrams: 50,
  breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
};

// A controllable quote request: the test decides when (and how) it settles.
const fakeRequest = () => {
  let resolve!: (quote: QuoteDone) => void;
  let reject!: (failure: QuoteFailure) => void;
  const promise = new Promise<QuoteDone>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const close = vi.fn();
  const request: QuoteRequest = { promise, close };
  return { request, resolve, reject, close };
};

const container = document.createElement("div");
document.body.appendChild(container);
let requests: ReturnType<typeof fakeRequest>[];
let startQuote: Mock<(fileId: string) => QuoteRequest>;

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  requests = [];
  startQuote = vi.fn<(fileId: string) => QuoteRequest>(() => {
    const next = fakeRequest();
    requests.push(next);
    return next.request;
  });
});
afterEach(() => {
  render(null, container);
  vi.unstubAllGlobals();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const $ = (testId: string) => container.querySelector(`[data-testid=${testId}]`);

async function uploadFile(fileId = "file-1") {
  const input = container.querySelector("input[type=file]") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [new File([new Uint8Array(10)], "cube.stl")] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  FakeXhr.last.respond(201, { file_id: fileId, status: "valid" });
  await flush();
}

const backToStart = () =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === "Back to start") as HTMLButtonElement;

describe("slicing wait state", () => {
  it("AC-ws-1: a successful upload opens the quote request for its file-id and enters slicing", async () => {
    render(<App startQuote={startQuote} />, container);

    await uploadFile("abc-123");

    expect(startQuote).toHaveBeenCalledTimes(1);
    expect(startQuote).toHaveBeenCalledWith("abc-123");
    expect($("slicing-wait")).not.toBeNull();
    expect($("upload-result")).toBeNull();
  });

  it("AC-ws-2: shows Slicing... and Back to start only, with no quote content", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();

    expect($("slicing-indicator")?.textContent).toBe("Slicing...");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(backToStart()).toBeDefined();
    expect($("quote-result")).toBeNull();
    expect($("quote-price")).toBeNull();
  });

  it("AC-ws-3: Back to start closes the request and returns to a clean upload form", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();

    backToStart().click();
    await flush();

    expect(requests[0]?.close).toHaveBeenCalledTimes(1);
    expect($("upload-form")).not.toBeNull();
    expect($("slicing-wait")).toBeNull();
  });

  it("AC-ws-4: the cancel contract is the socket close; the server-side kill is covered by T10/T13", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();

    backToStart().click();

    // The UI does not wait for any acknowledgment: it is already back on the form.
    expect(requests[0]?.close).toHaveBeenCalled();
    await flush();
    expect($("upload-form")).not.toBeNull();
  });

  it("AC-ws-5: a late result from a cancelled request cannot reach a later flow", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile("first");
    backToStart().click();
    await flush();

    await uploadFile("second");
    expect(startQuote).toHaveBeenCalledTimes(2);
    expect(startQuote).toHaveBeenLastCalledWith("second");
    requests[0]?.resolve(QUOTE); // stale: the first request's late quote.done
    requests[0]?.reject({ kind: "connection_lost" });
    await flush();

    expect($("slicing-wait")).not.toBeNull(); // still waiting on the second request
    expect($("quote-result")).toBeNull();
    requests[1]?.resolve(QUOTE);
    await flush();
    expect($("quote-price")?.textContent).toBe("$5.70");
  });

  it("AC-ws-6: natural completion leaves slicing for the quote display", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();

    requests[0]?.resolve(QUOTE);
    await flush();

    expect($("slicing-wait")).toBeNull();
    expect($("quote-price")?.textContent).toBe("$5.70");
    expect(requests[0]?.close).not.toHaveBeenCalled();
  });

  it("AC-ws-6: a quote.error leaves slicing for the mapped error text only", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();

    requests[0]?.reject({ kind: "backend", code: "quote.unslicable", message: "RAW-BACKEND-DETAIL" });
    await flush();

    expect($("quote-result-message")?.textContent).toContain("can't quote it");
    expect(container.textContent).not.toContain("RAW-BACKEND-DETAIL");
  });

  it("a dropped connection while slicing shows the connection-lost text", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();

    requests[0]?.reject({ kind: "connection_lost" });
    await flush();

    expect($("quote-result-message")?.textContent).toContain("connection was lost");
  });

  it("a result that arrives after the click is discarded: the cancel wins", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();

    backToStart().click();
    requests[0]?.resolve(QUOTE); // same tick as the click
    await flush();

    expect($("upload-form")).not.toBeNull();
    expect($("quote-result")).toBeNull();
  });

  it("a second click on Back to start is harmless", async () => {
    render(<App startQuote={startQuote} />, container);
    await uploadFile();
    const button = backToStart();

    expect(() => {
      button.click();
      button.click();
    }).not.toThrow();
    await flush();

    expect(requests[0]?.close).toHaveBeenCalledTimes(1);
    expect($("upload-form")).not.toBeNull();
  });

  it("without startQuote the flow still ends at the upload-success screen", async () => {
    render(<App />, container);

    await uploadFile();

    expect($("upload-result")?.getAttribute("data-outcome")).toBe("success");
  });

  it("slicing is a state with a transition", () => {
    expect(transitions.startSlicing()).toEqual({ status: "slicing" });
  });
});
