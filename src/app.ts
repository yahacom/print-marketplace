import Fastify from "fastify";
import type { Writable } from "node:stream";
import { stlUploadModule } from "./modules/stl-upload/module.js";
import {
  registerRequestLogging,
  requestLoggingOptions,
} from "./request-logging.js";

export function buildApp(options: { logStream?: Writable } = {}) {
  const app = Fastify({
    ...requestLoggingOptions,
    logger: {
      level: process.env.NODE_ENV === "test" && !options.logStream ? "silent" : "info",
      ...(options.logStream && { stream: options.logStream }),
    },
  });

  registerRequestLogging(app);
  app.get("/health", async () => ({ status: "ok" }));
  app.register(stlUploadModule);

  return app;
}
