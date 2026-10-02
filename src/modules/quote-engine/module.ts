import websocket from "@fastify/websocket";
import type { FastifyPluginAsync } from "fastify";
import { createQuoteRepository } from "./repositories/quote-repository.js";
import { getModelPath } from "./repositories/model-reader.js";
import { MAX_MESSAGE_BYTES, quoteRoutes } from "./routes/quote-routes.js";
import { parseSliceOutput } from "./services/gcode-parser.js";
import { computePrice } from "./services/pricing-service.js";
import { createQuoteService, type QuoteService } from "./services/quote-service.js";
import { assertSlicerAvailable } from "./services/slicer-service.js";
import { cancelSlice, enqueueSlice } from "./services/slicer-queue.js";

export interface QuoteEngineOptions {
  // Injected by tests; production builds the real service from the environment.
  quoteService?: QuoteService;
}

// Wires the real dependencies. Throws if FIRESTORE_CREDENTIALS_JSON is missing
// or malformed (T3).
export const createDefaultQuoteService = (log: {
  error: (message: string) => void;
}): QuoteService =>
  createQuoteService({
    getModelPath,
    queue: { enqueue: enqueueSlice, cancel: cancelSlice },
    parse: parseSliceOutput,
    price: computePrice,
    repository: createQuoteRepository(),
    log,
  });

// Fail-fast startup check (T3 credentials, T4 slicer binary). Not called from
// buildApp: boot-time enforcement needs the deploy and CI environments to
// provide credentials and PrusaSlicer first (see T10 notes).
export const assertQuoteEngineReady = async (): Promise<void> => {
  createQuoteRepository();
  await assertSlicerAvailable();
};

// Entry for the quote-engine module (SAD §5). Layers: routes/ (WebSocket) →
// services/ (quote orchestration) → repositories/ (model files, Firestore).
export const quoteEngineModule: FastifyPluginAsync<QuoteEngineOptions> = async (
  app,
  options,
) => {
  let service = options.quoteService;
  // Built lazily so apps that never receive a quote request (and tests of other
  // modules) do not need Firestore credentials.
  const getService = () => (service ??= createDefaultQuoteService(app.log));

  await app.register(websocket, { options: { maxPayload: MAX_MESSAGE_BYTES } });
  await app.register(quoteRoutes, { getService });
};
