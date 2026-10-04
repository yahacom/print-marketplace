import type { FastifyPluginAsync } from "fastify";
import { SAFE_FILE_ID } from "../../stl-upload/file-id.js";
import type { OrderService } from "../services/order-service.js";

// Response bodies follow SAD §6 flows 1-6 (no openapi.yaml exists for this
// feature yet). The UI shows its own copy keyed on `code`, never `message`.
const NOT_FOUND_BODY = { code: "order.not_found", message: "no quote available yet" };
const ALREADY_DECIDED_BODY = {
  code: "order.already_decided",
  message: "this quote already has a final decision",
};
const FILE_MISSING_BODY = {
  code: "order.file_missing",
  message: "model needs to be re-uploaded before an order can be placed",
};
const INTERNAL_ERROR_BODY = {
  code: "order.internal_error",
  message: "Something went wrong. Please try again.",
};

export interface OrderRoutesOptions {
  // A getter, so the real service (Firestore credentials) is built on first use.
  getService: () => OrderService;
}

export const orderRoutes: FastifyPluginAsync<OrderRoutesOptions> = async (app, options) => {
  // Operational failures (e.g. Firestore down) must not leak their message.
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "order request failed");
    return reply.code(500).send(INTERNAL_ERROR_BODY);
  });

  // A malformed id and an unknown id get the same 404 (no existence leak, and
  // the id never reaches a Firestore document path unvalidated).
  app.get<{ Params: { fileId: string } }>("/api/v1/orders/:fileId", async (request, reply) => {
    const { fileId } = request.params;
    if (!SAFE_FILE_ID.test(fileId)) {
      return reply.code(404).send(NOT_FOUND_BODY);
    }

    const state = await options.getService().getOrderState(fileId);
    if (state.kind === "not_found") {
      return reply.code(404).send(NOT_FOUND_BODY);
    }

    const { price, estimatedPrintTime, filamentGrams, breakdown, filename, decision, decidedAt } =
      state.order;
    const quote = { price, estimatedPrintTime, filamentGrams, breakdown, filename };

    // "decided": final decision, the UI shows no confirm/decline controls (US-04).
    // "ready": quote fields for display, the UI shows the controls.
    return state.kind === "decided"
      ? { state: "decided", decision, decidedAt: decidedAt?.toDate().toISOString(), quote }
      : { state: "ready", quote };
  });

  // Flows 1, 4, 5 (AC-01, AC-04, AC-05).
  app.post<{ Params: { fileId: string } }>(
    "/api/v1/orders/:fileId/confirm",
    async (request, reply) => {
      const { fileId } = request.params;
      if (!SAFE_FILE_ID.test(fileId)) {
        return reply.code(404).send(NOT_FOUND_BODY);
      }

      switch (await options.getService().decide(fileId, "confirmed")) {
        case "decided":
          return reply.code(201).send({ status: "confirmed" });
        case "not_found":
          return reply.code(404).send(NOT_FOUND_BODY);
        case "already_decided":
          return reply.code(409).send(ALREADY_DECIDED_BODY);
        case "file_missing":
          return reply.code(409).send(FILE_MISSING_BODY);
      }
    },
  );

  // Flows 2, 4 (AC-02, AC-04). Unlike confirm, no model-file check (flow 5 is
  // confirm-only), so the service never answers file_missing here.
  app.post<{ Params: { fileId: string } }>(
    "/api/v1/orders/:fileId/decline",
    async (request, reply) => {
      const { fileId } = request.params;
      if (!SAFE_FILE_ID.test(fileId)) {
        return reply.code(404).send(NOT_FOUND_BODY);
      }

      switch (await options.getService().decide(fileId, "declined")) {
        case "decided":
          return reply.code(200).send({ status: "declined" });
        case "not_found":
          return reply.code(404).send(NOT_FOUND_BODY);
        case "already_decided":
        case "file_missing":
          return reply.code(409).send(ALREADY_DECIDED_BODY);
      }
    },
  );
};
