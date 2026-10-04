// Test-only in-memory stand-in for the slice of Firestore this module uses.
// There is no emulator in this repo (same precedent as quote-repository's
// tests). Transactions are optimistic like Firestore's: one whose read
// document changed before commit is re-run. Used via vi.mock in tests.
type Data = Record<string, unknown>;

export class FakeTimestamp {
  constructor(private readonly date = new Date()) {}
  toDate(): Date {
    return this.date;
  }
}

const SERVER_TIMESTAMP = { fake: "server-timestamp" };

export const docs = new Map<string, Data>();
// Every committed write, in order, for "exactly one decision write" assertions.
export const committedWrites: Array<{ id: string; data: Data }> = [];
const versions = new Map<string, number>();
const version = (id: string) => versions.get(id) ?? 0;

export const resetFakeFirestore = (): void => {
  docs.clear();
  committedWrites.length = 0;
  versions.clear();
};

const snapshotOf = (id: string) => ({
  exists: docs.has(id),
  data: () => (docs.has(id) ? { ...docs.get(id) } : undefined),
});

const commit = (id: string, data: Data, merge: boolean) => {
  const resolved = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value === SERVER_TIMESTAMP ? new FakeTimestamp() : value,
    ]),
  );
  docs.set(id, merge ? { ...docs.get(id), ...resolved } : { ...resolved });
  committedWrites.push({ id, data: resolved });
  versions.set(id, version(id) + 1);
};

const docRef = (id: string) => ({
  id,
  get: async () => snapshotOf(id),
  set: async (data: Data, options?: { merge?: boolean }) => commit(id, data, options?.merge ?? false),
});

type Transaction = {
  get: (ref: { id: string }) => Promise<ReturnType<typeof snapshotOf>>;
  update: (ref: { id: string }, data: Data) => void;
};

const runTransaction = async <T>(body: (transaction: Transaction) => Promise<T>): Promise<T> => {
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
    for (const { id, data } of writes) commit(id, data, true);
    return result;
  }
};

export const firebaseAppModuleMock = {
  initializeApp: () => ({ name: "fake-app" }),
  cert: (account: unknown) => ({ account }),
};

export const firebaseFirestoreModuleMock = {
  getFirestore: () => ({ collection: () => ({ doc: docRef }), runTransaction }),
  FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP },
};
