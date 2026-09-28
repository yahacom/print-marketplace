import { randomUUID } from "node:crypto";
import { LogController, type FastifyInstance } from "fastify";
import type { IncomingMessage } from "node:http";

const REQUEST_ID_HEADER = "x-request-id";
// The inbound header is untrusted and ends up in every log line, so only
// accept a short, plain token; anything else gets a fresh id.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function generateRequestId(req: IncomingMessage): string {
  const inbound = req.headers[REQUEST_ID_HEADER];
  return typeof inbound === "string" && SAFE_REQUEST_ID.test(inbound)
    ? inbound
    : randomUUID();
}

// Fastify's default per-request logging emits two lines (incoming + completed)
// and includes the raw url; it is disabled in favour of the single line below.
// Side effect: Fastify's default error-handler log lines are suppressed too.
export const requestLoggingOptions = {
  genReqId: generateRequestId,
  logController: new LogController({
    requestIdLogLabel: "request_id",
    disableRequestLogging: true,
  }),
};

// One structured line per request (SAD §8). Only method, path (no query
// string), status and duration are logged — never the body, filename or headers.
export function registerRequestLogging(app: FastifyInstance): void {
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        path: request.url.split("?")[0],
        status: reply.statusCode,
        duration_ms: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });
}
