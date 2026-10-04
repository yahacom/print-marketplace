import type { FastifyPluginAsync } from "fastify";
import { modelFileExists } from "./repositories/model-file-check.js";
import { createOrderRepository } from "./repositories/order-repository.js";
import { orderRoutes } from "./routes/order-routes.js";
import { createOrderService, type OrderService } from "./services/order-service.js";

export interface OrderConfirmationOptions {
  // Injected by tests; production builds the real service from the environment.
  orderService?: OrderService;
}

// Wires the real dependencies. Throws if FIRESTORE_CREDENTIALS_JSON is missing
// or malformed.
export const createDefaultOrderService = (): OrderService =>
  createOrderService({
    repository: createOrderRepository(),
    modelFileCheck: modelFileExists,
  });

// Self-wiring entry for the order-confirmation module (SAD §5).
// Layers: routes/ (HTTP) → services/ (confirm/decline use case) →
// repositories/ (Firestore draftOrders).
export const orderConfirmationModule: FastifyPluginAsync<OrderConfirmationOptions> = async (
  app,
  options,
) => {
  let service = options.orderService;
  // Built lazily so apps that never receive an order request (and tests of other
  // modules) do not need Firestore credentials.
  const getService = () => (service ??= createDefaultOrderService());

  await app.register(orderRoutes, { getService });
};
