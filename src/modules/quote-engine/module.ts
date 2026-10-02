import type { FastifyPluginAsync } from "fastify";

// Entry for the quote-engine module (SAD §5). Stub from T1: deliberately not
// registered in src/app.ts until T10 adds the WebSocket route.
export const quoteEngineModule: FastifyPluginAsync = async () => {
  throw new Error("not implemented");
};
