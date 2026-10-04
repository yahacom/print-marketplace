import { FieldValue, getFirestore, type Timestamp } from "firebase-admin/firestore";
import { getFirestoreApp } from "../../../shared/firestore-app.js";
import type { DraftOrder } from "../../quote-engine/repositories/quote-repository.js";

const DRAFT_ORDERS_COLLECTION = "draftOrders";

export type Decision = "confirmed" | "declined";

export type DecisionFields = {
  decision: Decision;
  decidedAt: Timestamp;
};

export type StoredOrder = DraftOrder & Partial<DecisionFields>;

export type DecideResult = "decided" | "already_decided" | "not_found";

export type OrderRepository = {
  // The draftOrders document (quote fields, plus decision fields once decided),
  // or null when no quote exists for fileId.
  getDraftOrder: (fileId: string) => Promise<StoredOrder | null>;
  decideOrder: (fileId: string, decision: Decision) => Promise<DecideResult>;
};

// Builds the Firestore-backed repository over quote-engine's draftOrders
// documents (ADR-0006). It only ever writes decision/decidedAt, never the quote
// fields. Call it at module startup so a missing or malformed
// FIRESTORE_CREDENTIALS_JSON fails the boot instead of the first request.
export const createOrderRepository = (
  env: NodeJS.ProcessEnv = process.env,
): OrderRepository => {
  const db = getFirestore(getFirestoreApp(env));
  const draftOrders = db.collection(DRAFT_ORDERS_COLLECTION);

  return {
    getDraftOrder: async (fileId) => {
      const snapshot = await draftOrders.doc(fileId).get();
      return snapshot.exists ? (snapshot.data() as StoredOrder) : null;
    },

    // ADR-0007: the "no decision yet" check and the write share one
    // transaction, so of two concurrent callers exactly one commits. Firestore
    // may re-run this body on contention, so it must stay free of side effects
    // beyond the transaction's own write.
    decideOrder: (fileId, decision) =>
      db.runTransaction(async (transaction): Promise<DecideResult> => {
        const ref = draftOrders.doc(fileId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return "not_found";
        if (snapshot.data()?.decision !== undefined) return "already_decided";

        transaction.update(ref, { decision, decidedAt: FieldValue.serverTimestamp() });
        return "decided";
      }),
  };
};
