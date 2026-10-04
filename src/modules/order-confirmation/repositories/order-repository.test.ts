import { beforeEach, describe, expect, it, vi } from "vitest";
import { docs, FakeTimestamp, resetFakeFirestore } from "../fake-firestore.js";

vi.mock("firebase-admin/app", async () => (await import("../fake-firestore.js")).firebaseAppModuleMock);
vi.mock(
  "firebase-admin/firestore",
  async () => (await import("../fake-firestore.js")).firebaseFirestoreModuleMock,
);

const { createOrderRepository } = await import("./order-repository.js");

const FAKE_KEY_JSON = JSON.stringify({ project_id: "test-project", private_key: "not-a-real-key" });
const FILE_ID = "11111111-1111-4111-8111-111111111111";

const quote = {
  price: 9.5,
  estimatedPrintTime: 5400,
  filamentGrams: 40,
  breakdown: { timeCost: 3.75, materialCost: 0.8, margin: 0.91 },
  filename: "model.stl",
  slicingTime: 1,
};

const repository = () => createOrderRepository({ FIRESTORE_CREDENTIALS_JSON: FAKE_KEY_JSON });

beforeEach(() => {
  resetFakeFirestore();
});

describe("getDraftOrder", () => {
  it("returns null for an unknown fileId", async () => {
    expect(await repository().getDraftOrder(FILE_ID)).toBeNull();
  });

  it("returns the quote without decision fields for an undecided order", async () => {
    docs.set(FILE_ID, { ...quote });

    const order = await repository().getDraftOrder(FILE_ID);

    expect(order).toEqual(quote);
    expect(order).not.toHaveProperty("decision");
    expect(order).not.toHaveProperty("decidedAt");
  });

  it("returns quote and decision fields for a decided order", async () => {
    docs.set(FILE_ID, { ...quote, decision: "declined", decidedAt: "ts" });

    expect(await repository().getDraftOrder(FILE_ID)).toEqual({
      ...quote,
      decision: "declined",
      decidedAt: "ts",
    });
  });
});

describe("decideOrder", () => {
  it("records the decision with a server timestamp and leaves the quote fields alone", async () => {
    docs.set(FILE_ID, { ...quote });

    expect(await repository().decideOrder(FILE_ID, "confirmed")).toBe("decided");

    expect(docs.get(FILE_ID)).toMatchObject({ ...quote, decision: "confirmed" });
    expect(docs.get(FILE_ID)?.decidedAt).toBeInstanceOf(FakeTimestamp);
  });

  it("returns not_found and writes nothing for an unknown fileId", async () => {
    expect(await repository().decideOrder(FILE_ID, "confirmed")).toBe("not_found");
    expect(docs.has(FILE_ID)).toBe(false);
  });

  it("returns already_decided and keeps the first decision, even for the opposite choice", async () => {
    docs.set(FILE_ID, { ...quote });
    const repo = repository();
    await repo.decideOrder(FILE_ID, "confirmed");

    expect(await repo.decideOrder(FILE_ID, "declined")).toBe("already_decided");
    expect(docs.get(FILE_ID)).toMatchObject({ decision: "confirmed" });
  });

  it("QG-1: two concurrent decisions resolve to exactly one decided and one already_decided", async () => {
    docs.set(FILE_ID, { ...quote });
    const repo = repository();

    const results = await Promise.all([
      repo.decideOrder(FILE_ID, "confirmed"),
      repo.decideOrder(FILE_ID, "declined"),
    ]);

    expect(results.filter((result) => result === "decided")).toHaveLength(1);
    expect(results.filter((result) => result === "already_decided")).toHaveLength(1);
  });
});
