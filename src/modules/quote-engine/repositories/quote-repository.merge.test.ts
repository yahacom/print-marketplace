import { beforeEach, expect, it, vi } from "vitest";

// In-memory stand-in for Firestore that honours set() vs set(..., {merge: true}).
const store = new Map<string, Record<string, unknown>>();
const set = vi.fn(async (id: string, data: Record<string, unknown>, options?: { merge?: boolean }) => {
  store.set(id, options?.merge ? { ...store.get(id), ...data } : { ...data });
});
const doc = (id: string) => ({ set: (data: Record<string, unknown>, options?: { merge?: boolean }) => set(id, data, options) });
const collection = vi.fn(() => ({ doc }));

vi.mock("firebase-admin/app", () => ({ initializeApp: () => ({ name: "fake-app" }), cert: (account: unknown) => ({ account }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ collection }) }));

const { createQuoteRepository } = await import("./quote-repository.js");

const FAKE_KEY_JSON = JSON.stringify({ project_id: "test-project", private_key: "not-a-real-key" });
const FILE_ID = "11111111-1111-4111-8111-111111111111";

const order = {
  price: 9.5,
  estimatedPrintTime: 5400,
  filamentGrams: 40,
  breakdown: { timeCost: 3.75, materialCost: 0.8, margin: 0.91 },
  filename: "model.stl",
  slicingTime: 1,
};

beforeEach(() => {
  store.clear();
});

it("AC-04: a re-quote keeps decision fields and updates the quote fields", async () => {
  const repository = createQuoteRepository({ FIRESTORE_CREDENTIALS_JSON: FAKE_KEY_JSON });
  await repository.writeDraftOrder(FILE_ID, order);
  // What order-confirmation's transaction writes on confirm/decline.
  store.set(FILE_ID, { ...store.get(FILE_ID), decision: "confirmed", decidedAt: "2026-10-04T10:00:00Z" });

  await repository.writeDraftOrder(FILE_ID, { ...order, price: 12.25 });

  expect(store.get(FILE_ID)).toMatchObject({
    price: 12.25,
    decision: "confirmed",
    decidedAt: "2026-10-04T10:00:00Z",
  });
});
