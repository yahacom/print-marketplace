import { beforeEach, expect, it, vi } from "vitest";

const initializeApp = vi.fn(() => ({ name: "fake-app" }));
const cert = vi.fn((account: unknown) => ({ account }));

vi.mock("firebase-admin/app", () => ({ initializeApp, cert }));

const { getFirestoreApp } = await import("./firestore-app.js");

const FAKE_KEY_JSON = JSON.stringify({ project_id: "test-project", private_key: "not-a-real-key" });

beforeEach(() => {
  vi.clearAllMocks();
});

it("throws a clear error when the credential env var is unset", () => {
  expect(() => getFirestoreApp({})).toThrow(/FIRESTORE_CREDENTIALS_JSON is not set/);
  expect(initializeApp).not.toHaveBeenCalled();
});

it("throws without echoing the value when the credential is not valid JSON", () => {
  const act = () => getFirestoreApp({ FIRESTORE_CREDENTIALS_JSON: "super-secret{" });

  expect(act).toThrow(/not valid JSON/);
  expect(act).not.toThrow(/super-secret/);
  expect(initializeApp).not.toHaveBeenCalled();
});

it("returns the same memoized app on a second call, initializing only once", () => {
  const env = { FIRESTORE_CREDENTIALS_JSON: FAKE_KEY_JSON };

  const first = getFirestoreApp(env);
  const second = getFirestoreApp(env);

  expect(second).toBe(first);
  expect(initializeApp).toHaveBeenCalledTimes(1);
  expect(cert).toHaveBeenCalledWith(JSON.parse(FAKE_KEY_JSON));
});

it("still fails fast on a bad credential after the app was initialized", () => {
  getFirestoreApp({ FIRESTORE_CREDENTIALS_JSON: FAKE_KEY_JSON });

  expect(() => getFirestoreApp({})).toThrow(/FIRESTORE_CREDENTIALS_JSON is not set/);
});
