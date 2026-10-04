import { getFirestore } from "firebase-admin/firestore";
import { getFirestoreApp } from "../../../shared/firestore-app.js";

const DRAFT_ORDERS_COLLECTION = "draftOrders";

export type DraftOrder = {
  price: number;
  estimatedPrintTime: number; // seconds, integer
  filamentGrams: number;
  breakdown: Record<string, number>;
  filename: string;
  slicingTime: number; // seconds, integer
};

export type QuoteRepository = {
  writeDraftOrder: (fileId: string, order: DraftOrder) => Promise<void>;
};

// Builds the Firestore-backed repository (ADR-0002). The credential comes from
// the shared firestore-app. Call it at module startup so a missing or
// malformed FIRESTORE_CREDENTIALS_JSON fails the boot instead of the first
// quote request.
export const createQuoteRepository = (
  env: NodeJS.ProcessEnv = process.env,
): QuoteRepository => {
  const app = getFirestoreApp(env);
  const draftOrders = getFirestore(app).collection(DRAFT_ORDERS_COLLECTION);

  return {
    // Re-quote of the same fileId overwrites only the quote fields; merge keeps
    // order-confirmation's decision/decidedAt on the shared document (ADR-0006/0007).
    // A failed write rejects; the caller must not report the quote as done.
    writeDraftOrder: async (fileId, order) => {
      await draftOrders.doc(fileId).set(order, { merge: true });
    },
  };
};
