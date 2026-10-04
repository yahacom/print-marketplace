// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, transitions } from "./app.js";
import type { OrderFailure } from "./errors.js";
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
const RAW_MESSAGE = "RAW-BACKEND-DETAIL";
const FILE_ID = "11111111-1111-4111-8111-111111111111";

const container = document.createElement("div");
document.body.appendChild(container);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const $ = (testId: string) => container.querySelector(`[data-testid=${testId}]`) as HTMLElement | null;
const click = async (testId: string) => {
  ($(testId) as HTMLButtonElement).click();
  await flush();
};
const buttonLabels = () => [...container.querySelectorAll("button")].map((b) => b.textContent);

const confirmOrder = vi.fn<(fileId: string) => Promise<void>>();
const declineOrder = vi.fn<(fileId: string) => Promise<void>>();

const renderQuote = () =>
  render(
    <App
      initialState={transitions.quoteReady(QUOTE, "a.stl", FILE_ID)}
      orderClient={{ confirmOrder, declineOrder }}
    />,
    container,
  );

const backendFailure = (status: number, code: string): OrderFailure => ({
  kind: "backend",
  status,
  code,
  message: RAW_MESSAGE,
});

beforeEach(() => {
  confirmOrder.mockReset().mockResolvedValue(undefined);
  declineOrder.mockReset().mockResolvedValue(undefined);
});
afterEach(() => render(null, container));

describe("confirm on the quote screen", () => {
  it("shows Confirm next to Back to start", () => {
    renderQuote();

    expect(buttonLabels()).toEqual(["Back to start", "Confirm order"]);
  });

  it("AC-01: Confirm succeeds -> confirmed message, decision button gone", async () => {
    renderQuote();

    await click("confirm-button");

    expect(confirmOrder).toHaveBeenCalledExactlyOnceWith(FILE_ID);
    expect($("order-result-message")?.textContent).toBe("Order confirmed");
    expect($("confirm-button")).toBeNull();
    expect(buttonLabels()).toEqual(["Back to start"]);
  });

  it("AC-04: Confirm on an already-decided quote shows the final-decision text and no retry", async () => {
    confirmOrder.mockRejectedValue(backendFailure(409, "order.already_decided"));
    renderQuote();

    await click("confirm-button");

    expect($("order-result-message")?.textContent).toContain("already has a final decision");
    expect(container.textContent).not.toContain(RAW_MESSAGE);
    expect($("confirm-button")).toBeNull();
    expect(buttonLabels()).toEqual(["Back to start"]);
    expect(confirmOrder).toHaveBeenCalledTimes(1);
  });

  it("AC-05: Confirm with the model file gone shows the re-upload text", async () => {
    confirmOrder.mockRejectedValue(backendFailure(409, "order.file_missing"));
    renderQuote();

    await click("confirm-button");

    expect($("order-result-message")?.textContent).toContain("re-uploaded");
    expect(container.textContent).not.toContain(RAW_MESSAGE);
  });

  it("a network failure shows the unreachable text, not a raw error", async () => {
    confirmOrder.mockRejectedValue({ kind: "network" } satisfies OrderFailure);
    renderQuote();

    await click("confirm-button");

    expect($("order-result-message")?.textContent).toContain("couldn't reach the server");
  });

  it("an unrecognised backend code shows generic text, never the raw message", async () => {
    confirmOrder.mockRejectedValue(backendFailure(500, "order.internal_error"));
    renderQuote();

    await click("confirm-button");

    expect($("order-result-message")?.textContent).toContain("Something went wrong");
    expect(container.textContent).not.toContain(RAW_MESSAGE);
  });

  it("disables Confirm and Back to start while the request is in flight", async () => {
    let settle!: () => void;
    confirmOrder.mockReturnValue(new Promise<void>((resolve) => (settle = resolve)));
    renderQuote();

    await click("confirm-button");

    expect(($("confirm-button") as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelectorAll("button")[0] as HTMLButtonElement).disabled).toBe(true);

    settle();
    await flush();
    expect($("order-result-message")?.textContent).toBe("Order confirmed");
  });

  it("US-05: a double click sends one request", async () => {
    let settle!: () => void;
    confirmOrder.mockReturnValue(new Promise<void>((resolve) => (settle = resolve)));
    renderQuote();
    const button = $("confirm-button") as HTMLButtonElement;

    button.click();
    button.click();
    await flush();
    button.click();
    settle();
    await flush();

    expect(confirmOrder).toHaveBeenCalledTimes(1);
  });

  it("Back to start from the final screen returns to the upload form", async () => {
    renderQuote();
    await click("confirm-button");

    (container.querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect($("upload-form")).not.toBeNull();
    expect($("order-result")).toBeNull();
  });

  it("shows no Confirm button for a quote state without a file id", () => {
    render(<App initialState={transitions.quoteReady(QUOTE, "a.stl")} />, container);

    expect($("confirm-button")).toBeNull();
  });
});

describe("the file id reaches the order client through the real upload -> quote flow", () => {
  beforeEach(() => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("confirms the file id returned by the upload", async () => {
    const startQuote = vi.fn<(fileId: string, filename: string) => QuoteRequest>(() => ({
      promise: Promise.resolve(QUOTE),
      close: vi.fn(),
    }));
    render(<App startQuote={startQuote} orderClient={{ confirmOrder, declineOrder }} />, container);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [new File([new Uint8Array(10)], "cube.stl")] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    FakeXhr.last.respond(201, { file_id: "uploaded-id", status: "valid" });
    await flush();

    await click("confirm-button");

    expect(confirmOrder).toHaveBeenCalledExactlyOnceWith("uploaded-id");
    expect($("order-result-message")?.textContent).toBe("Order confirmed");
  });
});
