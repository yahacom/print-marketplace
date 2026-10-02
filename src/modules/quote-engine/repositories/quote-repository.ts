import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const CREDENTIALS_ENV = "FIRESTORE_CREDENTIALS_JSON";
const DRAFT_ORDERS_COLLECTION = "draftOrders";

export type DraftOrder = {
  price: number;
  timeMinutes: number;
  filamentGrams: number;
  breakdown: Record<string, number>;
};

export type QuoteRepository = {
  writeDraftOrder: (fileId: string, order: DraftOrder) => Promise<void>;
};

// Builds the Firestore-backed repository (ADR-0002). The service-account key
// is read once, here, from FIRESTORE_CREDENTIALS_JSON (the JSON itself, not a
// path). Call it at module startup so a missing or malformed credential fails
// the boot instead of the first quote request. Errors never include the
// credential value.
export const createQuoteRepository = (
  env: NodeJS.ProcessEnv = process.env,
): QuoteRepository => {
  const rawCredentials = env[CREDENTIALS_ENV];
  if (!rawCredentials) {
    throw new Error(`${CREDENTIALS_ENV} is not set; quote-engine cannot persist quotes`);
  }

  let serviceAccount: unknown;
  try {
    serviceAccount = JSON.parse(rawCredentials);
  } catch {
    throw new Error(`${CREDENTIALS_ENV} is not valid JSON`);
  }

  const app = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
  const draftOrders = getFirestore(app).collection(DRAFT_ORDERS_COLLECTION);

  return {
    // Overwrites any existing draft for the same fileId (re-quote). A failed
    // write rejects; the caller must not report the quote as done.
    writeDraftOrder: async (fileId, order) => {
      await draftOrders.doc(fileId).set(order);
    },
  };
};
