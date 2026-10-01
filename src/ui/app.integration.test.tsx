// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./app.js";
import { toUserMessage } from "./errors.js";

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  responseText = "";
  timeout = 0;
  upload: { onprogress: ((event: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }
  open() {}
  send() {}
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

const container = document.createElement("div");
document.body.appendChild(container);

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});
afterEach(() => {
  render(null, container);
  vi.unstubAllGlobals();
});

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function selectFile(name = "cube.stl") {
  render(<App />, container);
  const input = container.querySelector("input[type=file]") as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [new File([new Uint8Array(10)], name)] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
}

function resultMessage(): string | null | undefined {
  return container.querySelector("[data-testid=upload-result-message]")?.textContent;
}

describe("App end-to-end (mocked XHR)", () => {
  it("shows progress while uploading, then success with the filename (AC-01)", async () => {
    await selectFile("cube.stl");
    expect(container.querySelector("[data-testid=upload-progress]")).not.toBeNull();

    FakeXhr.last.progress(5, 10);
    await flush();
    expect(container.querySelector("[data-testid=upload-progress-percent]")?.textContent).toBe("50%");

    FakeXhr.last.respond(201, { file_id: "abc", status: "valid" });
    await flush();
    expect(container.querySelector("[data-testid=upload-progress]")).toBeNull();
    expect(container.querySelector("[data-outcome=success]")?.textContent).toContain("cube.stl");
  });

  it("renders the AC-02 message for upload.invalid_format", async () => {
    await selectFile();
    FakeXhr.last.respond(400, { code: "upload.invalid_format", message: "raw backend text" });
    await flush();

    expect(resultMessage()).toBe(
      toUserMessage({ kind: "backend", status: 400, code: "upload.invalid_format", message: "" }),
    );
    expect(container.textContent).not.toContain("raw backend text");
  });

  it("renders the AC-03 message for upload.file_too_large, distinct from AC-02", async () => {
    await selectFile();
    FakeXhr.last.respond(413, { code: "upload.file_too_large", message: "raw backend text" });
    await flush();
    const tooLarge = resultMessage();
    expect(tooLarge).toBe(
      toUserMessage({ kind: "backend", status: 413, code: "upload.file_too_large", message: "" }),
    );

    render(null, container);
    await selectFile();
    FakeXhr.last.respond(400, { code: "upload.invalid_format", message: "x" });
    await flush();
    expect(resultMessage()).not.toBe(tooLarge);
  });

  it("renders the AC-04 message on network failure and stops showing progress", async () => {
    await selectFile();
    FakeXhr.last.progress(3, 10);
    FakeXhr.last.onerror?.();
    await flush();

    expect(resultMessage()).toBe(toUserMessage({ kind: "network" }));
    expect(container.querySelector("[data-testid=upload-progress]")).toBeNull();
  });
});
