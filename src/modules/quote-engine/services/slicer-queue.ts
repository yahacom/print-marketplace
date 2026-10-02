import { randomUUID } from "node:crypto";
import { sliceModel, type SliceResult } from "./slicer-service.js";

// In-process FIFO queue with a single worker (T7, ADR-0003): at most one
// PrusaSlicer run at a time, everything else waits in memory. The queue is lost
// on restart and cannot span instances (SAD §7).

export interface SliceJob {
  id: string;
  promise: Promise<SliceResult>;
}

interface QueuedJob {
  id: string;
  stlPath: string;
  controller: AbortController;
  resolve: (result: SliceResult) => void;
  reject: (error: unknown) => void;
}

type SliceFn = (
  stlPath: string,
  timeoutMs: number,
  signal?: AbortSignal,
) => Promise<SliceResult>;

export interface SlicerQueue {
  enqueue: (stlPath: string) => SliceJob;
  cancel: (jobId: string) => void;
  getQueueDepth: () => number;
}

// PRD §6 targets p95 ≤60s turnaround, so a single slice must not run longer.
const DEFAULT_SLICE_TIMEOUT_MS = 60_000;

const cancelledResult = (): SliceResult => ({
  info: null,
  slice: null,
  gcodePath: null,
  timedOut: false,
  cancelled: true,
  cleanup: async () => {},
});

export const createSlicerQueue = (
  slice: SliceFn = sliceModel,
  timeoutMs = Number(process.env.SLICER_TIMEOUT_MS) || DEFAULT_SLICE_TIMEOUT_MS,
): SlicerQueue => {
  const pending: QueuedJob[] = [];
  const known = new Map<string, QueuedJob>(); // pending + running, by id
  let draining = false;

  const drain = async (): Promise<void> => {
    if (draining) return;
    draining = true;
    try {
      for (let job = pending.shift(); job; job = pending.shift()) {
        try {
          job.resolve(await slice(job.stlPath, timeoutMs, job.controller.signal));
        } catch (error) {
          // A failed job must not wedge the worker (AC-sq-4).
          job.reject(error);
        } finally {
          known.delete(job.id);
        }
      }
    } finally {
      draining = false;
    }
  };

  const enqueue = (stlPath: string): SliceJob => {
    const id = randomUUID();
    const promise = new Promise<SliceResult>((resolve, reject) => {
      const job = { id, stlPath, controller: new AbortController(), resolve, reject };
      pending.push(job);
      known.set(id, job);
    });
    void drain();
    return { id, promise };
  };

  // Pending job: drop it without ever invoking the slicer. Running job: abort it
  // via T4's signal. Unknown or already-finished ids are a no-op.
  const cancel = (jobId: string): void => {
    const job = known.get(jobId);
    if (!job) return;
    const index = pending.indexOf(job);
    if (index === -1) {
      job.controller.abort();
      return;
    }
    pending.splice(index, 1);
    known.delete(jobId);
    job.resolve(cancelledResult());
  };

  return { enqueue, cancel, getQueueDepth: () => pending.length };
};

const defaultQueue = createSlicerQueue();

export const enqueueSlice = defaultQueue.enqueue;
export const cancelSlice = defaultQueue.cancel;
export const getQueueDepth = defaultQueue.getQueueDepth;
