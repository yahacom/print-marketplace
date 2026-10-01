import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UploadFailure } from "./errors.js";
import { submitUpload } from "./upload-client.js";

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  responseText = "";
  timeout = 0;
  method = "";
  url = "";
  body: unknown;
  upload: { onprogress: ((event: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: unknown) {
    this.body = body;
  }
  respond(status: number, responseText: string) {
    this.status = status;
    this.responseText = responseText;
    this.onload?.();
  }
}

const file = new File(["solid"], "part.stl", { type: "model/stl" });
const noProgress = () => {};

async function rejection(promise: Promise<unknown>): Promise<UploadFailure> {
  try {
    await promise;
  } catch (failure) {
    return failure as UploadFailure;
  }
  throw new Error("expected the upload to reject");
}

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitUpload", () => {
  it("posts the file as multipart form data to the uploads endpoint", () => {
    void submitUpload(file, noProgress);
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("/api/v1/uploads");
    expect((xhr.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("resolves with the parsed body on 2xx", async () => {
    const promise = submitUpload(file, noProgress);
    FakeXhr.last.respond(201, JSON.stringify({ file_id: "abc", status: "valid" }));
    await expect(promise).resolves.toEqual({ file_id: "abc", status: "valid" });
  });

  it.each([
    [400, "upload.invalid_format"],
    [413, "upload.file_too_large"],
    [429, "upload.rate_limited"],
    [500, "internal.error"],
  ])("rejects with the backend {code,message} on %i", async (status, code) => {
    const promise = submitUpload(file, noProgress);
    FakeXhr.last.respond(status, JSON.stringify({ code, message: "raw detail" }));
    expect(await rejection(promise)).toEqual({ kind: "backend", status, code, message: "raw detail" });
  });

  it("rejects as a backend failure when an error body is not {code,message}", async () => {
    const promise = submitUpload(file, noProgress);
    FakeXhr.last.respond(502, "<html>Bad Gateway</html>");
    expect(await rejection(promise)).toMatchObject({ kind: "backend", status: 502 });
  });

  it("rejects with a network marker on onerror", async () => {
    const promise = submitUpload(file, noProgress);
    FakeXhr.last.onerror?.();
    expect(await rejection(promise)).toEqual({ kind: "network" });
  });

  it("rejects with a timeout marker, distinct from network, on timeout", async () => {
    const promise = submitUpload(file, noProgress);
    expect(FakeXhr.last.timeout).toBeGreaterThan(0);
    FakeXhr.last.ontimeout?.();
    expect(await rejection(promise)).toEqual({ kind: "timeout" });
  });

  it("invokes the progress callback on each onprogress event", () => {
    const onProgress = vi.fn();
    void submitUpload(file, onProgress);
    const { upload } = FakeXhr.last;
    upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 100 });
    upload.onprogress?.({ lengthComputable: true, loaded: 60, total: 100 });
    upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    expect(onProgress.mock.calls).toEqual([
      [{ loaded: 10, total: 100 }],
      [{ loaded: 60, total: 100 }],
      [{ loaded: 100, total: 100 }],
    ]);
  });

  it("ignores progress events whose total is not computable", () => {
    const onProgress = vi.fn();
    void submitUpload(file, onProgress);
    FakeXhr.last.upload.onprogress?.({ lengthComputable: false, loaded: 10, total: 0 });
    expect(onProgress).not.toHaveBeenCalled();
  });
});
