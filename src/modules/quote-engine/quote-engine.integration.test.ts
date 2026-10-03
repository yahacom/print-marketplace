import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { generateFileId } from "../stl-upload/file-id.js";
import { getModelPath } from "./repositories/model-reader.js";
import type { DraftOrder } from "./repositories/quote-repository.js";
import { parseSliceOutput } from "./services/gcode-parser.js";
import { computePrice } from "./services/pricing-service.js";
import { createQuoteService } from "./services/quote-service.js";
import { createSlicerQueue } from "./services/slicer-queue.js";
import { nonWatertightCubeStl, oversizedCubeStl, validCubeStl } from "./test-support/stl-fixtures.js";

// End to end across every layer: real buildApp(), real WebSocket client, real
// STORAGE_DIR, real PrusaSlicer. Only Firestore is replaced by an in-memory
// repository (no emulator/credentials in tests); the T3 mapping is unit-tested.
// Needs PrusaSlicer on PATH and permission to bind a local port.

let storageDir: string;
let app: ReturnType<typeof buildApp>;
let drafts: Array<{ fileId: string; order: DraftOrder }>;

beforeEach(async () => {
  storageDir = await mkdtemp(join(tmpdir(), "quote-it-"));
  process.env.STORAGE_DIR = storageDir;
  drafts = [];
  const service = createQuoteService({
    getModelPath,
    queue: createSlicerQueue(),
    parse: parseSliceOutput,
    price: computePrice,
    repository: {
      writeDraftOrder: async (fileId, order) => {
        drafts.push({ fileId, order });
      },
    },
    log: { error: () => {} },
  });
  app = buildApp({ quoteService: service });
  await app.listen({ port: 0, host: "127.0.0.1" });
});

afterEach(async () => {
  await app.close();
  delete process.env.STORAGE_DIR;
  await rm(storageDir, { recursive: true, force: true });
});

const store = async (content: string | Buffer): Promise<string> => {
  const fileId = generateFileId();
  await writeFile(join(storageDir, `${fileId}.stl`), content);
  return fileId;
};

// Asks for a quote over a real WebSocket. Resolves on the server's close event
// (AC-it-6) with the raw text of every message received.
const askForQuote = (fileId: string, filename = "cube.stl") =>
  new Promise<{ raw: string[]; closeCode: number }>((resolve, reject) => {
    const address = app.server.address();
    if (typeof address !== "object" || address === null) throw new Error("not listening");
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/quotes`);
    const raw: string[] = [];
    socket.onopen = () => socket.send(JSON.stringify({ type: "quote.request", fileId, filename }));
    socket.onmessage = (event) => raw.push(String(event.data));
    socket.onclose = (event) => resolve({ raw, closeCode: event.code });
    socket.onerror = () => reject(new Error("socket error"));
  });

const onlyMessage = (result: { raw: string[]; closeCode: number }) => {
  // AC-it-6: exactly one message, then the server closed the connection cleanly.
  expect(result.raw).toHaveLength(1);
  expect(result.closeCode).toBe(1000);
  return JSON.parse(result.raw[0]!) as Record<string, unknown>;
};

describe("quote-engine end to end", () => {
  it("AC-it-1: a non-watertight model (PrusaSlicer exits 0) is quote.unslicable", async () => {
    const message = onlyMessage(await askForQuote(await store(nonWatertightCubeStl())));

    expect(message).toMatchObject({ type: "quote.error", code: "quote.unslicable" });
    expect(drafts).toEqual([]);
  });

  it.each([
    ["an empty file", () => Buffer.alloc(0)],
    ["random bytes", () => randomBytes(256)],
  ])("AC-it-1: %s (non-zero exit) is quote.unslicable", async (_name, make) => {
    const message = onlyMessage(await askForQuote(await store(make())));

    expect(message).toMatchObject({ type: "quote.error", code: "quote.unslicable" });
    expect(drafts).toEqual([]);
  });

  it("AC-it-2: an oversized model (exit 0, no G-code) is quote.exceeds_build_volume", async () => {
    const message = onlyMessage(await askForQuote(await store(oversizedCubeStl())));

    expect(message).toMatchObject({ type: "quote.error", code: "quote.exceeds_build_volume" });
    expect(drafts).toEqual([]);
  });

  it("AC-it-3 / AC-it-4: a missing id and a malformed/foreign id get byte-identical quote.not_found", async () => {
    const never = await askForQuote(generateFileId()); // valid format, nothing stored
    const foreign = await askForQuote("../../etc/passwd"); // not a valid id at all

    expect(onlyMessage(never)).toMatchObject({ type: "quote.error", code: "quote.not_found" });
    expect(foreign.raw).toEqual(never.raw);
    expect(foreign.closeCode).toBe(never.closeCode);
    expect(drafts).toEqual([]);
  });

  it("AC-it-5: a valid printable model returns the full quote with breakdown and writes the draft", async () => {
    const fileId = await store(validCubeStl());

    const message = onlyMessage(await askForQuote(fileId));

    expect(message).toMatchObject({ type: "quote.done" });
    const { price, timeMinutes, filamentGrams, breakdown } = message as {
      price: number;
      timeMinutes: number;
      filamentGrams: number;
      breakdown: { timeCost: number; materialCost: number; margin: number };
    };
    expect(timeMinutes).toBeGreaterThan(0);
    expect(filamentGrams).toBeGreaterThan(0);
    // AC-03: the three components are present and add up to the total.
    expect(breakdown.timeCost + breakdown.materialCost + breakdown.margin).toBeCloseTo(price, 9);
    expect(breakdown.margin).toBeCloseTo((breakdown.timeCost + breakdown.materialCost) * 0.2, 9);
    expect(drafts).toHaveLength(1);
    const draft = drafts[0]!;
    expect(draft.fileId).toBe(fileId);
    expect(draft.order.filename).toBe("cube.stl");
    expect(draft.order.estimatedPrintTime).toBe(Math.round(timeMinutes * 60));
    expect(draft.order.slicingTime).toEqual(expect.any(Number));
    expect(draft.order.price).toBeCloseTo(price, 2);
    expect(draft.order.filamentGrams).toBeCloseTo(filamentGrams, 2);
    expect(draft.order.breakdown.timeCost).toBeCloseTo(breakdown.timeCost, 2);
    expect(draft.order.breakdown.materialCost).toBeCloseTo(breakdown.materialCost, 2);
    expect(draft.order.breakdown.margin).toBeCloseTo(breakdown.margin, 2);
  });
});
