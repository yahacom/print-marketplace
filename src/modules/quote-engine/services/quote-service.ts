import { randomUUID } from "node:crypto";
import type { NotFound } from "../repositories/model-reader.js";
import type { DraftOrder, QuoteRepository } from "../repositories/quote-repository.js";
import { parseSliceOutput } from "./gcode-parser.js";
import { computePrice } from "./pricing-service.js";
import type { SlicerQueue } from "./slicer-queue.js";

// Orchestrates read → queue/slice → parse → price → persist (T8, SAD §6) and
// maps every outcome onto the quote.* sentinels (SAD §8).

export type QuoteSuccess = DraftOrder;
export type QuoteErrorCode =
  | "quote.not_found"
  | "quote.unslicable"
  | "quote.exceeds_build_volume";
export type QuoteResult =
  | QuoteSuccess
  | { error: QuoteErrorCode }
  | { cancelled: true };

export interface QuoteServiceDeps {
  getModelPath: (fileId: string) => Promise<string | NotFound>;
  queue: Pick<SlicerQueue, "enqueue" | "cancel">;
  parse: typeof parseSliceOutput;
  price: typeof computePrice;
  repository: QuoteRepository;
  log: { error: (message: string) => void };
}

export interface QuoteRequest {
  jobId: string;
  // Resolves with a QuoteResult. Rejects only for operational failures
  // (storage/Firestore/slicer crash), never for a user-input problem.
  promise: Promise<QuoteResult>;
}

interface RequestState {
  cancelled: boolean;
  queueJobId?: string;
}

// One shared object for both not-found causes: AC-05 (missing) and AC-06
// (malformed / not owned) must be indistinguishable to the client.
const NOT_FOUND: QuoteResult = Object.freeze({ error: "quote.not_found" });
const CANCELLED: QuoteResult = Object.freeze({ cancelled: true });

export type QuoteService = ReturnType<typeof createQuoteService>;

export const createQuoteService = (deps: QuoteServiceDeps) => {
  const requests = new Map<string, RequestState>();

  const run = async (fileId: string, state: RequestState): Promise<QuoteResult> => {
    const modelPath = await deps.getModelPath(fileId);
    if (typeof modelPath !== "string") return NOT_FOUND;
    // The caller walked away while we were resolving the file: don't queue it.
    if (state.cancelled) return CANCELLED;

    const job = deps.queue.enqueue(modelPath);
    state.queueJobId = job.id;
    const sliced = await job.promise;

    try {
      if (sliced.cancelled) return CANCELLED;
      if (sliced.timedOut) return { error: "quote.unslicable" };
      if (sliced.info?.exitCode !== 0 || sliced.slice?.exitCode !== 0) {
        // Includes a stage that never ran. Oversized models exit 0 and are
        // classified by the parser below, never from the exit code.
        return { error: "quote.unslicable" };
      }

      const parsed = await deps.parse(sliced);
      if (parsed.kind === "exceeds_build_volume") {
        return { error: "quote.exceeds_build_volume" };
      }
      if (parsed.kind === "non_manifold") return { error: "quote.unslicable" };
      if (parsed.kind === "parse_error") {
        // Signals slicer version drift, not bad user input: make it visible.
        deps.log.error(`quote-engine: unparseable slicer output: ${parsed.reason}`);
        return { error: "quote.unslicable" };
      }

      const { timeCost, materialCost, margin, totalPrice } = deps.price({
        timeMinutes: parsed.timeMinutes,
        filamentGrams: parsed.filamentGrams,
      });
      const quote: QuoteSuccess = {
        price: totalPrice,
        timeMinutes: parsed.timeMinutes,
        filamentGrams: parsed.filamentGrams,
        breakdown: { timeCost, materialCost, margin },
      };

      // Last point where cancellation can win: check and write are in the same
      // synchronous stretch, so a cancel either lands before (no draft is
      // written for a quote nobody sees) or after (the write is already
      // committed and the quote is reported).
      if (state.cancelled) return CANCELLED;
      await deps.repository.writeDraftOrder(fileId, quote);
      return quote;
    } finally {
      await sliced.cleanup();
    }
  };

  const requestQuote = (fileId: string): QuoteRequest => {
    const jobId = randomUUID();
    const state: RequestState = { cancelled: false };
    requests.set(jobId, state);
    const promise = run(fileId, state).finally(() => requests.delete(jobId));
    return { jobId, promise };
  };

  // Called by T10 when the WebSocket closes. Unknown/finished ids are a no-op.
  const cancelQuote = (jobId: string): void => {
    const state = requests.get(jobId);
    if (!state) return;
    state.cancelled = true;
    if (state.queueJobId !== undefined) deps.queue.cancel(state.queueJobId);
  };

  return { requestQuote, cancelQuote };
};
