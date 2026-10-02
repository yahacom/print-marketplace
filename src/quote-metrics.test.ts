import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createQuoteMetrics, quoteMetrics } from "./metrics.js";
import { createQuoteService, type QuoteServiceDeps } from "./modules/quote-engine/services/quote-service.js";
import { enqueueSlice } from "./modules/quote-engine/services/slicer-queue.js";
import type { SliceResult } from "./modules/quote-engine/services/slicer-service.js";

// Reads one sample's value out of rendered Prometheus text (0 if absent).
const sample = (text: string, series: string): number => {
  const line = text.split("\n").find((l) => l.startsWith(`${series} `));
  return line ? Number(line.slice(series.length + 1)) : 0;
};

describe("quote-engine metrics", () => {
  it("AC-mt-1: each observed request lands in the histogram buckets, sum and count", () => {
    const metrics = createQuoteMetrics();

    metrics.observeSliceDuration(3); // within 5 s, over 2.5 s
    metrics.observeSliceDuration(70); // beyond the last finite bucket
    const text = metrics.render();

    expect(text).toContain("# TYPE quote_slice_duration_seconds histogram");
    expect(text).toContain('quote_slice_duration_seconds_bucket{le="2.5"} 0');
    expect(text).toContain('quote_slice_duration_seconds_bucket{le="5"} 1');
    expect(text).toContain('quote_slice_duration_seconds_bucket{le="60"} 1');
    expect(text).toContain('quote_slice_duration_seconds_bucket{le="+Inf"} 2');
    expect(text).toContain("quote_slice_duration_seconds_sum 73");
    expect(text).toContain("quote_slice_duration_seconds_count 2");
  });

  it("AC-mt-1: quote-service records one observation for a finished request, success or failure", async () => {
    const result = (overrides: Partial<SliceResult>): SliceResult => ({
      info: { exitCode: 0, stdout: "", stderr: "" },
      slice: { exitCode: 0, stdout: "", stderr: "" },
      gcodePath: "/tmp/out.gcode",
      timedOut: false,
      cancelled: false,
      cleanup: async () => {},
      ...overrides,
    });
    const run = async (sliced: SliceResult) => {
      const service = createQuoteService({
        getModelPath: async () => "/storage/model.stl",
        queue: { enqueue: () => ({ id: "j", promise: Promise.resolve(sliced) }), cancel: () => {} },
        parse: async () => ({ kind: "stats", timeMinutes: 1, filamentGrams: 1 }),
        price: () => ({ timeCost: 1, materialCost: 1, margin: 1, totalPrice: 3 }),
        repository: { writeDraftOrder: async () => {} },
        log: { error: () => {} },
      } as QuoteServiceDeps);
      await service.requestQuote("id").promise;
    };
    const count = () => sample(quoteMetrics.render(), "quote_slice_duration_seconds_count");
    const before = count();

    await run(result({})); // success
    expect(count()).toBe(before + 1);
    await run(result({ timedOut: true, info: null, slice: null, gcodePath: null })); // failure
    expect(count()).toBe(before + 2);
  });

  it("AC-mt-2: queue depth is read live at render time", () => {
    const metrics = createQuoteMetrics();
    let depth = 0;
    metrics.setQueueDepthSource(() => depth);

    expect(metrics.render()).toContain("# TYPE quote_slicer_queue_depth gauge");
    expect(metrics.render()).toContain("\nquote_slicer_queue_depth 0\n");
    depth = 4;
    expect(metrics.render()).toContain("\nquote_slicer_queue_depth 4\n");
  });

  it("AC-mt-2: the real slicer queue is the depth source on /metrics", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/metrics" });

    expect(res.body).toContain("# TYPE quote_slicer_queue_depth gauge");
    expect(res.body).toContain("\nquote_slicer_queue_depth 0\n");
    expect(res.body).toContain("# TYPE quote_slice_duration_seconds histogram");
    // Keeps the existing HTTP histogram in the same scrape.
    expect(res.body).toContain("# TYPE http_request_duration_seconds histogram");
  });

  it("AC-mt-3: exit codes get separate counter series, and a signal exit is labelled none", () => {
    const metrics = createQuoteMetrics();

    metrics.countExitCode(0);
    metrics.countExitCode(0);
    metrics.countExitCode(1);
    metrics.countExitCode(null);
    const text = metrics.render();

    expect(text).toContain("# TYPE quote_slicer_exit_code counter");
    expect(text).toContain('quote_slicer_exit_code{code="0"} 2');
    expect(text).toContain('quote_slicer_exit_code{code="1"} 1');
    expect(text).toContain('quote_slicer_exit_code{code="none"} 1');
  });

  it("AC-mt-3: the slicer wrapper reports each stage's exit code (real PrusaSlicer)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "quote-metrics-"));
    try {
      const stl = join(dir, "empty.stl");
      await writeFile(stl, ""); // PrusaSlicer exits non-zero on an empty file
      const queued = enqueueSlice(stl);
      const result = await queued.promise;
      await result.cleanup();

      const text = quoteMetrics.render();
      const nonZero = text
        .split("\n")
        .filter((l) => l.startsWith("quote_slicer_exit_code{") && !l.includes('code="0"'));
      expect(nonZero.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
