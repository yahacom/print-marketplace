import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { fileURLToPath } from "node:url";
import type { Writable } from "node:stream";
import { registerMetrics } from "./metrics.js";
import { quoteEngineModule, type QuoteEngineOptions } from "./modules/quote-engine/module.js";
import { stlUploadModule } from "./modules/stl-upload/module.js";
import {
  registerRequestLogging,
  requestLoggingOptions,
} from "./request-logging.js";

// src/ and dist/ both sit one level below the repo root, so this resolves for tsx and compiled runs.
const defaultUiRoot = fileURLToPath(new URL("../dist-ui", import.meta.url));

export function buildApp(
  options: { logStream?: Writable; uiRoot?: string } & QuoteEngineOptions = {},
) {
  const app = Fastify({
    ...requestLoggingOptions,
    logger: {
      level: process.env.NODE_ENV === "test" && !options.logStream ? "silent" : "info",
      ...(options.logStream && { stream: options.logStream }),
    },
  });

  registerRequestLogging(app);
  registerMetrics(app);
  app.get("/health", async () => ({ status: "ok" }));
  app.register(stlUploadModule);
  app.register(quoteEngineModule, { quoteService: options.quoteService });
  app.register(fastifyStatic, { root: options.uiRoot ?? defaultUiRoot });

  return app;
}
