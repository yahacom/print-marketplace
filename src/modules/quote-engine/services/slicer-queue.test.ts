import { describe, expect, it } from "vitest";
import { createSlicerQueue } from "./slicer-queue.js";
import type { SliceResult } from "./slicer-service.js";

const result = (overrides: Partial<SliceResult> = {}): SliceResult => ({
  info: { exitCode: 0, stdout: "", stderr: "" },
  slice: { exitCode: 0, stdout: "", stderr: "" },
  gcodePath: "/tmp/out.gcode",
  timedOut: false,
  cancelled: false,
  cleanup: async () => {},
  ...overrides,
});

// A controllable fake of sliceModel: records start/finish order and the peak
// number of overlapping runs, and finishes each call only when the test says so.
const createFakeSlicer = () => {
  const started: string[] = [];
  const finished: string[] = [];
  let running = 0;
  let maxRunning = 0;
  const gates = new Map<string, (r: SliceResult) => void>();
  const signals = new Map<string, AbortSignal | undefined>();

  const slice = (stlPath: string, _timeoutMs: number, signal?: AbortSignal) => {
    started.push(stlPath);
    signals.set(stlPath, signal);
    running++;
    maxRunning = Math.max(maxRunning, running);
    return new Promise<SliceResult>((resolve, reject) => {
      const finish = (r: SliceResult | Error) => {
        running--;
        finished.push(stlPath);
        if (r instanceof Error) reject(r);
        else resolve(r);
      };
      gates.set(stlPath, (r) => finish(r));
      // Mirrors T4: an abort resolves the run as cancelled.
      signal?.addEventListener("abort", () => finish(result({ cancelled: true, gcodePath: null })));
      gates.set(`${stlPath}:throw`, () => finish(new Error("boom")));
    });
  };

  return {
    slice,
    started,
    finished,
    signals,
    get maxRunning() {
      return maxRunning;
    },
    complete: (stlPath: string, r = result()) => gates.get(stlPath)!(r),
    crash: (stlPath: string) => gates.get(`${stlPath}:throw`)!(result()),
  };
};

// Lets the queue's microtask chains settle.
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("slicer queue", () => {
  it("AC-sq-1: never runs two slices at once, even with 3 jobs enqueued together", async () => {
    const fake = createFakeSlicer();
    const queue = createSlicerQueue(fake.slice);

    const jobs = ["a", "b", "c"].map((p) => queue.enqueue(p));
    await settle();
    expect(fake.started).toEqual(["a"]);

    for (const p of ["a", "b", "c"]) {
      fake.complete(p);
      await settle();
    }
    await Promise.all(jobs.map((j) => j.promise));

    expect(fake.maxRunning).toBe(1);
    expect(fake.started).toEqual(["a", "b", "c"]);
  });

  it("AC-sq-2: completes in submission order, not by slice duration", async () => {
    const fake = createFakeSlicer();
    const queue = createSlicerQueue(fake.slice);
    const order: string[] = [];
    const jobs = ["a", "b", "c"].map((p) =>
      queue.enqueue(p).promise.then(() => order.push(p)),
    );

    // b and c cannot start until the job before them has finished.
    await settle();
    fake.complete("a");
    await settle();
    fake.complete("b");
    await settle();
    fake.complete("c");
    await Promise.all(jobs);

    expect(order).toEqual(["a", "b", "c"]);
  });

  it("AC-sq-3: depth is the number of pending jobs and tracks progress", async () => {
    const fake = createFakeSlicer();
    const queue = createSlicerQueue(fake.slice);
    expect(queue.getQueueDepth()).toBe(0);

    ["a", "b", "c", "d"].forEach((p) => queue.enqueue(p));
    await settle();
    expect(queue.getQueueDepth()).toBe(3); // a running, 3 waiting

    fake.complete("a");
    await settle();
    expect(queue.getQueueDepth()).toBe(2);

    for (const p of ["b", "c", "d"]) {
      fake.complete(p);
      await settle();
    }
    expect(queue.getQueueDepth()).toBe(0);
  });

  it("AC-sq-4: a failed job (timeout result or thrown error) does not block the next", async () => {
    const fake = createFakeSlicer();
    const queue = createSlicerQueue(fake.slice);
    const a = queue.enqueue("a");
    const b = queue.enqueue("b");
    const c = queue.enqueue("c");
    const aOutcome = a.promise.then(
      () => "resolved",
      (error: Error) => error.message,
    );

    await settle();
    fake.complete("a", result({ timedOut: true, gcodePath: null }));
    await settle();
    expect(fake.started).toEqual(["a", "b"]);
    fake.crash("b");
    await expect(b.promise).rejects.toThrow("boom");
    await settle();
    expect(fake.started).toEqual(["a", "b", "c"]);
    fake.complete("c");

    expect(await aOutcome).toBe("resolved");
    expect((await c.promise).gcodePath).not.toBeNull();
  });

  it("AC-sq-5: cancelling a pending job resolves it cancelled without ever calling the slicer", async () => {
    const fake = createFakeSlicer();
    const queue = createSlicerQueue(fake.slice);
    queue.enqueue("a");
    const b = queue.enqueue("b");
    const c = queue.enqueue("c");
    await settle();
    expect(queue.getQueueDepth()).toBe(2);

    queue.cancel(b.id);

    expect((await b.promise).cancelled).toBe(true);
    expect(queue.getQueueDepth()).toBe(1);
    fake.complete("a");
    await settle();
    fake.complete("c");
    await c.promise;
    expect(fake.started).toEqual(["a", "c"]);
  });

  it("AC-sq-6: cancelling the running job aborts it and starts the next job immediately", async () => {
    const fake = createFakeSlicer();
    const queue = createSlicerQueue(fake.slice);
    const a = queue.enqueue("a");
    const b = queue.enqueue("b");
    await settle();
    expect(fake.signals.get("a")?.aborted).toBe(false);

    queue.cancel(a.id);

    expect(fake.signals.get("a")?.aborted).toBe(true);
    expect((await a.promise).cancelled).toBe(true);
    await settle();
    expect(fake.started).toEqual(["a", "b"]);
    fake.complete("b");
    expect((await b.promise).cancelled).toBe(false);
  });

  it("cancel is a no-op for unknown, finished, or already-cancelled jobs", async () => {
    const fake = createFakeSlicer();
    const queue = createSlicerQueue(fake.slice);
    const a = queue.enqueue("a");
    const b = queue.enqueue("b");
    await settle();
    fake.complete("a");
    await a.promise;
    await settle();

    expect(() => {
      queue.cancel("no-such-job");
      queue.cancel(a.id);
      queue.cancel(b.id);
      queue.cancel(b.id);
    }).not.toThrow();
    expect((await b.promise).cancelled).toBe(true);
  });
});
