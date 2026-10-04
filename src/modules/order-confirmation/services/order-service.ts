import type { ModelFileCheck } from "../repositories/model-file-check.js";
import type { Decision, OrderRepository, StoredOrder } from "../repositories/order-repository.js";

export type DecideOutcome = "decided" | "already_decided" | "file_missing" | "not_found";

export type OrderState =
  | { kind: "not_found" }
  | { kind: "decided"; order: StoredOrder }
  | { kind: "ready"; order: StoredOrder };

export type OrderService = {
  decide: (fileId: string, decision: Decision) => Promise<DecideOutcome>;
  getOrderState: (fileId: string) => Promise<OrderState>;
};

type Dependencies = {
  repository: OrderRepository;
  modelFileCheck: ModelFileCheck;
};

// Confirm/decline use case (SAD §5 services/). HTTP status mapping is the
// routes' job; this layer only reports what happened.
export const createOrderService = ({ repository, modelFileCheck }: Dependencies): OrderService => ({
  // Flows 1, 2, 4, 5. An already-decided quote answers already_decided before
  // the file check, so a duplicate (AC-04) never reads as "file missing" (AC-05).
  // The transaction in decideOrder stays the real guard against a concurrent
  // decision; the early read only picks the right outcome for the common case.
  decide: async (fileId, decision) => {
    const order = await repository.getDraftOrder(fileId);
    if (order === null) return "not_found";
    if (order.decision !== undefined) return "already_decided";

    if (decision === "confirmed" && !(await modelFileCheck(fileId))) {
      return "file_missing";
    }

    return repository.decideOrder(fileId, decision);
  },

  // Flows 3 and 6: what the GET route shows for a fileId.
  getOrderState: async (fileId) => {
    const order = await repository.getDraftOrder(fileId);
    if (order === null) return { kind: "not_found" };
    return order.decision === undefined ? { kind: "ready", order } : { kind: "decided", order };
  },
});
