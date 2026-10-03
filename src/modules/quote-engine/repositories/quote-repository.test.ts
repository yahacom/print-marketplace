import { beforeEach, expect, it, vi } from "vitest";

const set = vi.fn();
const doc = vi.fn(() => ({ set }));
const collection = vi.fn(() => ({ doc }));
const initializeApp = vi.fn(() => ({ name: "fake-app" }));
const cert = vi.fn((account: unknown) => ({ account }));

vi.mock("firebase-admin/app", () => ({ initializeApp, cert }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ collection }) }));

const { createQuoteRepository } = await import("./quote-repository.js");

const FAKE_KEY_JSON = JSON.stringify({ project_id: "test-project", private_key: "not-a-real-key" });

const order = {
  price: 9.5,
  estimatedPrintTime: 5400,
  filamentGrams: 40,
  breakdown: { timeCost: 3.75, materialCost: 0.8, margin: 0.91 },
  filename: "model.stl",
  slicingTime: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  set.mockResolvedValue(undefined);
});

it("AC-fr-1: writes the quote fields to the draft-order document keyed by fileId", async () => {
  const repository = createQuoteRepository({ FIRESTORE_CREDENTIALS_JSON: FAKE_KEY_JSON });

  await repository.writeDraftOrder("11111111-1111-4111-8111-111111111111", order);

  expect(collection).toHaveBeenCalledWith("draftOrders");
  expect(doc).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  expect(set).toHaveBeenCalledWith(order);
  expect(cert).toHaveBeenCalledWith(JSON.parse(FAKE_KEY_JSON));
});

it("AC-fr-2: throws a clear startup error when the credential env var is unset", () => {
  expect(() => createQuoteRepository({})).toThrow(/FIRESTORE_CREDENTIALS_JSON is not set/);
  expect(initializeApp).not.toHaveBeenCalled();
});

it("AC-fr-2: throws without echoing the value when the credential is not valid JSON", () => {
  const act = () => createQuoteRepository({ FIRESTORE_CREDENTIALS_JSON: "super-secret{" });

  expect(act).toThrow(/not valid JSON/);
  expect(act).not.toThrow(/super-secret/);
});

it("propagates a failed Firestore write", async () => {
  set.mockRejectedValue(new Error("quota exceeded"));
  const repository = createQuoteRepository({ FIRESTORE_CREDENTIALS_JSON: FAKE_KEY_JSON });

  await expect(repository.writeDraftOrder("id", order)).rejects.toThrow("quota exceeded");
});
