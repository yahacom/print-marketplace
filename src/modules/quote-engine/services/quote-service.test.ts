import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedSlice } from "./gcode-parser.js";
import { createQuoteService, type QuoteServiceDeps } from "./quote-service.js";
import type { SliceResult } from "./slicer-service.js";

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const FILENAME = "model.stl";

const sliceResult = (overrides: Partial<SliceResult> = {}): SliceResult => ({
  info: { exitCode: 0, stdout: "", stderr: "" },
  slice: { exitCode: 0, stdout: "", stderr: "" },
  gcodePath: "/tmp/out.gcode",
  timedOut: false,
  cancelled: false,
  cleanup: vi.fn(async () => {}),
  ...overrides,
});

const STATS: ParsedSlice = { kind: "stats", timeMinutes: 90, filamentGrams: 50 };

// Deferred slice outcome so tests control when the queue "finishes" a job.
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

let deps: QuoteServiceDeps;
let writeDraftOrder: ReturnType<typeof vi.fn>;
let enqueue: ReturnType<typeof vi.fn>;
let queueCancel: ReturnType<typeof vi.fn>;
let logError: ReturnType<typeof vi.fn>;
let nextSlice: SliceResult;

const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  nextSlice = sliceResult();
  writeDraftOrder = vi.fn(async () => {});
  enqueue = vi.fn(() => ({ id: "queue-job-1", promise: Promise.resolve(nextSlice) }));
  queueCancel = vi.fn();
  logError = vi.fn();
  deps = {
    getModelPath: vi.fn(async () => "/storage/model.stl"),
    queue: { enqueue, cancel: queueCancel },
    parse: vi.fn(async () => STATS),
    price: vi.fn(() => ({ timeCost: 3.75, materialCost: 1, margin: 0.95, totalPrice: 5.7 })),
    repository: { writeDraftOrder },
    log: { error: logError },
  } as QuoteServiceDeps;
});

describe("requestQuote", () => {
  it("AC-qs-1: resolves with price, time, filament and breakdown, and writes the draft order", async () => {
    const { promise } = createQuoteService(deps).requestQuote(FILE_ID, FILENAME);

    const result = await promise;

    const expected = {
      price: 5.7,
      timeMinutes: 90,
      filamentGrams: 50,
      breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
    };
    expect(result).toEqual(expected);
    expect(writeDraftOrder).toHaveBeenCalledWith(FILE_ID, {
      ...expected,
      filename: FILENAME,
      slicingTimeMs: expect.any(Number),
    });
    expect(enqueue).toHaveBeenCalledWith("/storage/model.stl");
    expect(nextSlice.cleanup).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["info stage exits non-zero", { info: { exitCode: 1, stdout: "", stderr: "" }, slice: null, gcodePath: null }],
    ["slice stage exits non-zero", { slice: { exitCode: 1, stdout: "", stderr: "" }, gcodePath: null }],
    ["the job timed out", { timedOut: true, info: null, slice: null, gcodePath: null }],
  ])("AC-qs-2: %s -> quote.unslicable, no write, temp dir cleaned", async (_name, overrides) => {
    nextSlice = sliceResult(overrides);

    const result = await createQuoteService(deps).requestQuote(FILE_ID).promise;

    expect(result).toEqual({ error: "quote.unslicable" });
    expect(deps.parse).not.toHaveBeenCalled();
    expect(writeDraftOrder).not.toHaveBeenCalled();
    expect(nextSlice.cleanup).toHaveBeenCalledTimes(1);
  });

  it("AC-qs-2: a non-watertight model that PrusaSlicer slices with exit 0 is still quote.unslicable", async () => {
    vi.mocked(deps.parse).mockResolvedValue({ kind: "non_manifold" });

    const result = await createQuoteService(deps).requestQuote(FILE_ID).promise;

    expect(result).toEqual({ error: "quote.unslicable" });
    expect(writeDraftOrder).not.toHaveBeenCalled();
    expect(nextSlice.cleanup).toHaveBeenCalledTimes(1);
  });

  it("parse_error maps to quote.unslicable and is logged for the operator", async () => {
    vi.mocked(deps.parse).mockResolvedValue({ kind: "parse_error", reason: "format drift" });

    const result = await createQuoteService(deps).requestQuote(FILE_ID).promise;

    expect(result).toEqual({ error: "quote.unslicable" });
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("format drift"));
    expect(writeDraftOrder).not.toHaveBeenCalled();
  });

  it("AC-qs-3: an oversized model (exit 0, no G-code) -> quote.exceeds_build_volume from the parser's classification", async () => {
    nextSlice = sliceResult({ gcodePath: null });
    vi.mocked(deps.parse).mockResolvedValue({ kind: "exceeds_build_volume" });

    const result = await createQuoteService(deps).requestQuote(FILE_ID).promise;

    expect(result).toEqual({ error: "quote.exceeds_build_volume" });
    expect(writeDraftOrder).not.toHaveBeenCalled();
    expect(nextSlice.cleanup).toHaveBeenCalledTimes(1);
  });

  it("AC-qs-4: a file-id with no stored file -> quote.not_found, nothing queued", async () => {
    vi.mocked(deps.getModelPath).mockResolvedValue({ notFound: true });

    const result = await createQuoteService(deps).requestQuote(FILE_ID).promise;

    expect(result).toEqual({ error: "quote.not_found" });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("AC-qs-5: missing and malformed ids produce exactly the same result, byte for byte", async () => {
    // The reader treats both identically; model that with its real contract.
    vi.mocked(deps.getModelPath).mockResolvedValue({ notFound: true });
    const service = createQuoteService(deps);

    const missing = await service.requestQuote(FILE_ID).promise;
    const malformed = await service.requestQuote("../../etc/passwd").promise;

    expect(malformed).toEqual(missing);
    expect(JSON.stringify(malformed)).toBe(JSON.stringify(missing));
    expect(JSON.stringify(missing)).toBe('{"error":"quote.not_found"}');
  });

  it("AC-qs-6: a failed Firestore write rejects instead of reporting success, and still cleans up", async () => {
    writeDraftOrder.mockRejectedValue(new Error("firestore down"));

    const outcome = createQuoteService(deps).requestQuote(FILE_ID).promise;

    await expect(outcome).rejects.toThrow("firestore down");
    expect(nextSlice.cleanup).toHaveBeenCalledTimes(1);
  });

  it("propagates an operational read failure as a rejection, not a quote.* code", async () => {
    vi.mocked(deps.getModelPath).mockRejectedValue(new Error("EACCES"));

    await expect(createQuoteService(deps).requestQuote(FILE_ID).promise).rejects.toThrow("EACCES");
  });
});

describe("cancelQuote", () => {
  it("AC-qs-7: cancelling after enqueue forwards to the queue; the result is cancelled with no write", async () => {
    const slicing = deferred<SliceResult>();
    enqueue.mockReturnValue({ id: "queue-job-1", promise: slicing.promise });
    const service = createQuoteService(deps);
    const { jobId, promise } = service.requestQuote(FILE_ID);
    await settle();

    service.cancelQuote(jobId);
    expect(queueCancel).toHaveBeenCalledWith("queue-job-1");
    // The queue answers with a cancelled result, as T7/T4 do.
    const cancelled = sliceResult({ cancelled: true, gcodePath: null, info: null, slice: null });
    slicing.resolve(cancelled);

    expect(await promise).toEqual({ cancelled: true });
    expect(writeDraftOrder).not.toHaveBeenCalled();
    expect(deps.parse).not.toHaveBeenCalled();
    expect(cancelled.cleanup).toHaveBeenCalledTimes(1);
  });

  it("AC-qs-8: the slice finishing in the same tick as the cancel yields exactly one outcome and no write", async () => {
    const slicing = deferred<SliceResult>();
    enqueue.mockReturnValue({ id: "queue-job-1", promise: slicing.promise });
    const service = createQuoteService(deps);
    const { jobId, promise } = service.requestQuote(FILE_ID);
    await settle();

    // Real slice result arrives, and the cancel lands before the write is reached.
    slicing.resolve(nextSlice);
    service.cancelQuote(jobId);
    const result = await promise;

    expect(result).toEqual({ cancelled: true });
    expect(writeDraftOrder).not.toHaveBeenCalled();
    expect(nextSlice.cleanup).toHaveBeenCalledTimes(1);
  });

  it("AC-qs-8: a cancel after the write has started does not turn a written quote into cancelled", async () => {
    const write = deferred<void>();
    writeDraftOrder.mockReturnValue(write.promise);
    const service = createQuoteService(deps);
    const { jobId, promise } = service.requestQuote(FILE_ID);
    await settle();
    expect(writeDraftOrder).toHaveBeenCalledTimes(1);

    service.cancelQuote(jobId);
    write.resolve();

    expect(await promise).toMatchObject({ price: 5.7 });
  });

  it("cancelling before the file is resolved never enqueues a slice", async () => {
    const reading = deferred<string>();
    vi.mocked(deps.getModelPath).mockReturnValue(reading.promise);
    const service = createQuoteService(deps);
    const { jobId, promise } = service.requestQuote(FILE_ID);

    service.cancelQuote(jobId);
    reading.resolve("/storage/model.stl");

    expect(await promise).toEqual({ cancelled: true });
    expect(enqueue).not.toHaveBeenCalled();
    expect(queueCancel).not.toHaveBeenCalled();
  });

  it("cancelling an unknown or already finished request is a no-op", async () => {
    const service = createQuoteService(deps);
    const { jobId, promise } = service.requestQuote(FILE_ID);
    await promise;

    expect(() => {
      service.cancelQuote(jobId);
      service.cancelQuote("nope");
    }).not.toThrow();
    expect(queueCancel).not.toHaveBeenCalled();
  });
});
