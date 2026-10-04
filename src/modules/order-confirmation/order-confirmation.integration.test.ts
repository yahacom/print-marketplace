import Fastify from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQuoteRepository } from "../quote-engine/repositories/quote-repository.js";
import { generateFileId } from "../stl-upload/file-id.js";
import { saveModel } from "../stl-upload/repositories/model-repository.js";
import { committedWrites, docs, resetFakeFirestore } from "./fake-firestore.js";
import { orderConfirmationModule } from "./module.js";

vi.mock("firebase-admin/app", async () => (await import("./fake-firestore.js")).firebaseAppModuleMock);
vi.mock(
  "firebase-admin/firestore",
  async () => (await import("./fake-firestore.js")).firebaseFirestoreModuleMock,
);

// Real routes, service, repository and stl-upload storage (temp dir); only
// Firestore is the in-memory fake. Quotes are seeded through quote-engine's
// real writeDraftOrder, the way a real quote would arrive.
const quote = {
  price: 9.5,
  estimatedPrintTime: 5400,
  filamentGrams: 40,
  breakdown: { timeCost: 3.75, materialCost: 0.8, margin: 0.91 },
  filename: "model.stl",
  slicingTime: 1,
};

let storageDir: string;

const seedQuote = async ({ withModelFile = true } = {}): Promise<string> => {
  const fileId = generateFileId();
  if (withModelFile) await saveModel(fileId, Buffer.from("solid x"));
  await createQuoteRepository().writeDraftOrder(fileId, quote);
  return fileId;
};

const buildTestApp = () => {
  const app = Fastify();
  app.register(orderConfirmationModule);
  return app;
};

const post = (app: ReturnType<typeof buildTestApp>, fileId: string, action: "confirm" | "decline") =>
  app.inject({ method: "POST", url: `/api/v1/orders/${fileId}/${action}` });

const get = (app: ReturnType<typeof buildTestApp>, fileId: string) =>
  app.inject({ url: `/api/v1/orders/${fileId}` });

const decisionWrites = () => committedWrites.filter(({ data }) => "decision" in data);

beforeEach(async () => {
  resetFakeFirestore();
  storageDir = await mkdtemp(join(tmpdir(), "order-confirmation-"));
  process.env.STORAGE_DIR = storageDir;
  process.env.FIRESTORE_CREDENTIALS_JSON = JSON.stringify({ project_id: "test" });
});

afterEach(async () => {
  delete process.env.STORAGE_DIR;
  delete process.env.FIRESTORE_CREDENTIALS_JSON;
  await rm(storageDir, { recursive: true, force: true });
});

describe("order-confirmation end to end", () => {
  it("AC-01: confirming a quote returns 201 and the decision is then visible", async () => {
    const fileId = await seedQuote();
    const app = buildTestApp();

    const response = await post(app, fileId, "confirm");

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: "confirmed" });
    expect((await get(app, fileId)).json()).toMatchObject({ state: "decided", decision: "confirmed" });
  });

  it("AC-02: declining a quote returns 200 and the decision is then visible", async () => {
    const fileId = await seedQuote();
    const app = buildTestApp();

    const response = await post(app, fileId, "decline");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "declined" });
    expect((await get(app, fileId)).json()).toMatchObject({ state: "decided", decision: "declined" });
  });

  it("AC-03: a fileId with no quote is 404 no-quote-yet on GET, confirm and decline", async () => {
    const app = buildTestApp();
    const fileId = generateFileId();

    for (const response of [
      await get(app, fileId),
      await post(app, fileId, "confirm"),
      await post(app, fileId, "decline"),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ code: "order.not_found", message: "no quote available yet" });
    }
    expect(decisionWrites()).toHaveLength(0);
  });

  it("AC-03: a ready quote reads back its stored quote fields without a decision", async () => {
    const fileId = await seedQuote();

    const response = await get(buildTestApp(), fileId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      state: "ready",
      quote: {
        price: 9.5,
        estimatedPrintTime: 5400,
        filamentGrams: 40,
        breakdown: quote.breakdown,
        filename: "model.stl",
      },
    });
  });

  it("AC-04: a second decision of either kind is 409 and the first decision stands", async () => {
    const fileId = await seedQuote();
    const app = buildTestApp();
    await post(app, fileId, "confirm");

    for (const response of [await post(app, fileId, "confirm"), await post(app, fileId, "decline")]) {
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        code: "order.already_decided",
        message: "this quote already has a final decision",
      });
    }
    expect(docs.get(fileId)).toMatchObject({ decision: "confirmed" });
    expect(decisionWrites()).toHaveLength(1);
  });

  it.each([
    ["confirm", "confirm"],
    ["confirm", "decline"],
    ["decline", "confirm"],
  ] as const)(
    "QG-1: concurrent %s + %s gives exactly one success, one 409 and one committed decision write",
    async (first, second) => {
      const fileId = await seedQuote();
      const app = buildTestApp();

      const responses = await Promise.all([post(app, fileId, first), post(app, fileId, second)]);

      expect(responses.filter((response) => response.statusCode === 409)).toHaveLength(1);
      expect(responses.filter((response) => [200, 201].includes(response.statusCode))).toHaveLength(1);
      expect(decisionWrites()).toHaveLength(1);
    },
  );

  it("AC-05: confirming with the model file gone is 409 file-missing and records nothing", async () => {
    const fileId = await seedQuote({ withModelFile: false });
    const app = buildTestApp();

    const response = await post(app, fileId, "confirm");

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "order.file_missing",
      message: "model needs to be re-uploaded before an order can be placed",
    });
    expect(decisionWrites()).toHaveLength(0);
  });
});
