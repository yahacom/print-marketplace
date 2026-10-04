import type { FastifyPluginAsync } from "fastify";

// Self-wiring entry for the order-confirmation module (SAD §5).
// Layers: routes/ (HTTP) → services/ (confirm/decline use case) →
// repositories/ (Firestore draftOrders). Later tasks register their pieces here.
export const orderConfirmationModule: FastifyPluginAsync = async () => {};
