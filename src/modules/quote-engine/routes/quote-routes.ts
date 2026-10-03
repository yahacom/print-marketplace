import type { FastifyPluginAsync } from "fastify";
import type { QuoteErrorCode, QuoteService } from "../services/quote-service.js";
import { createQuoteRateLimiter } from "./rate-limit.js";

// Protocol (ADR-0001), one quote request per connection:
//   client -> server  first text message: { "type": "quote.request", "fileId": "<uuid>", "filename": "<original name>" }
//   server -> client  exactly one of
//     { "type": "quote.done", price, timeMinutes, filamentGrams, breakdown }
//     { "type": "quote.error", code, message }
//   then the server closes the socket (1000). Any later client message is ignored.
// The file-id travels in the first message rather than the URL so it never
// appears in proxy/access logs.

export const QUOTE_WS_PATH = "/api/v1/quotes";
// A request message is ~80 bytes; anything much bigger is not a client of ours.
export const MAX_MESSAGE_BYTES = 1024;

type ErrorCode = QuoteErrorCode | "quote.rate_limited" | "quote.internal_error";

// Plain-language text per code (PRD §2). The UI shows its own copy keyed on `code`.
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  "quote.not_found": "We couldn't find that model. Please upload it again.",
  "quote.unslicable": "We couldn't prepare this model for printing, so we can't quote it.",
  "quote.exceeds_build_volume": "This model is larger than our printer can handle.",
  "quote.rate_limited":
    "Too many quote requests from this connection. Please wait a moment and try again.",
  "quote.internal_error": "Something went wrong while preparing your quote. Please try again.",
};

const errorMessage = (code: ErrorCode) => ({
  type: "quote.error",
  code,
  message: ERROR_MESSAGES[code],
});

// Anything that is not a well-formed request maps to an unusable id, so it gets
// the same quote.not_found as a missing file (AC-05/AC-06, no existence leak).
const extractRequest = (raw: string): { fileId: string; filename: string } => {
  try {
    const parsed = JSON.parse(raw) as { fileId?: unknown; filename?: unknown } | null;
    return {
      fileId: typeof parsed?.fileId === "string" ? parsed.fileId : "",
      filename: typeof parsed?.filename === "string" ? parsed.filename : "",
    };
  } catch {
    return { fileId: "", filename: "" };
  }
};

export interface QuoteRoutesOptions {
  // A getter, so the real service (Firestore credentials) is built on first use.
  getService: () => QuoteService;
}

export const quoteRoutes: FastifyPluginAsync<QuoteRoutesOptions> = async (app, options) => {
  const checkRateLimit = createQuoteRateLimiter();

  app.get(QUOTE_WS_PATH, { websocket: true }, (socket, request) => {
    let started = false;
    let jobId: string | undefined;

    const finish = (message: object) => {
      if (socket.readyState !== socket.OPEN) return; // client already left
      socket.send(JSON.stringify(message));
      socket.close(1000);
    };

    socket.on("message", (data) => {
      if (started) return;
      started = true;

      const decision = checkRateLimit(request.ip);
      if (!decision.allowed) {
        finish(errorMessage("quote.rate_limited"));
        return;
      }

      let quote;
      try {
        const { fileId, filename } = extractRequest(data.toString());
        quote = options.getService().requestQuote(fileId, filename);
      } catch (error) {
        request.log.error({ err: error }, "quote-engine unavailable");
        finish(errorMessage("quote.internal_error"));
        return;
      }
      jobId = quote.jobId;

      quote.promise.then(
        (result) => {
          if ("cancelled" in result) return; // the socket is already gone
          if ("error" in result) finish(errorMessage(result.error));
          else finish({ type: "quote.done", ...result });
        },
        (error: unknown) => {
          request.log.error({ err: error }, "quote request failed");
          finish(errorMessage("quote.internal_error"));
        },
      );
    });

    // Any close reason (Back to start, network drop, tab close) cancels the job:
    // the slicer is hard-killed and no draft is written. After a finished quote
    // this is a no-op inside the service.
    socket.on("close", () => {
      if (jobId !== undefined) options.getService().cancelQuote(jobId);
    });
  });
};
