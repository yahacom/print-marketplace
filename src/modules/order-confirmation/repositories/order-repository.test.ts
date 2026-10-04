import { beforeEach, describe, expect, it, vi } from "vitest";

// No Firestore emulator in this repo (same precedent as quote-repository tests),
// so this is an in-memory fake with optimistic-concurrency transactions: a
// transaction whose read document changed before commit is re-run, like Firestore.
type Data = Record<string, unknown>;
const SERVER_TIMESTAMP = { fake: "server-timestamp" };

const docs = new Map<string, Data>();
const versions = new Map<string, number>();
const version = (id: string) => versions.get(id) ?? 0;

const snapshotOf = (id: string) => ({
  exists: docs.has(id),
  data: () => (docs.has(id) ? structuredClone(docs.get(id)) : undefined),
});
const docRef = (id: string) => ({ id, get: async () => snapshotOf(id) });

const runTransaction = async <T>(
  body: (transaction: {
    get: (ref: { id: string }) => Promise<ReturnType<typeof snapshotOf>>;
    update: (ref: { id: string }, data: Data) => void;
  }) => Promise<T>,
): Promise<T> => {
  for (;;) {
    const readVersions = new Map<string, number>();
    const writes: Array<{ id: string; data: Data }> = [];
    const result = await body({
      get: async (ref) => {
        const snapshot = snapshotOf(ref.id);
        readVersions.set(ref.id, version(ref.id));
        await Promise.resolve(); // yield, so concurrent transactions interleave
        return snapshot;
      },
      update: (ref, data) => writes.push({ id: ref.id, data }),
    });
    const stale = [...readVersions].some(([id, read]) => version(id) !== read);
    if (stale) continue;
    for (const { id, data } of writes) {
      docs.set(id, { ...docs.get(id), ...data });
      versions.set(id, version(id) + 1);
    }
    return result;
  }
};

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({ name: "fake-app" }),
  cert: (account: unknown) => ({ account }),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ collection: () => ({ doc: docRef }), runTransaction }),
  FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP },
}));

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
  docs.clear();
  versions.clear();
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

    expect(docs.get(FILE_ID)).toEqual({ ...quote, decision: "confirmed", decidedAt: SERVER_TIMESTAMP });
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
