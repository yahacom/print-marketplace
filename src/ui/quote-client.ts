// WebSocket client for quote-engine (ADR-0001). One request per connection:
// send the file-id, wait for exactly one `quote.done` / `quote.error` push.
// Resolves with the quote; rejects with a `QuoteFailure` that `errors.ts` maps to user text.
import type { QuoteFailure } from "./errors.js";

export interface QuoteBreakdown {
  timeCost: number;
  materialCost: number;
  margin: number;
}

export interface QuoteDone {
  price: number;
  timeMinutes: number;
  filamentGrams: number;
  breakdown: QuoteBreakdown;
}

export interface QuoteRequest {
  promise: Promise<QuoteDone>;
  // Closes the socket from the client side (the server cancels the slice on close).
  // Safe to call at any time and more than once. After it, `promise` never settles.
  close: () => void;
}

const QUOTE_ENDPOINT_PATH = "/api/v1/quotes";

// Used when a push is not the documented shape (e.g. a proxy injecting a message).
const UNPARSEABLE_ERROR_CODE = "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toQuoteDone(body: Record<string, unknown>): QuoteDone | undefined {
  const { price, timeMinutes, filamentGrams, breakdown } = body;
  if (
    isNumber(price) &&
    isNumber(timeMinutes) &&
    isNumber(filamentGrams) &&
    isRecord(breakdown) &&
    isNumber(breakdown.timeCost) &&
    isNumber(breakdown.materialCost) &&
    isNumber(breakdown.margin)
  ) {
    return {
      price,
      timeMinutes,
      filamentGrams,
      breakdown: {
        timeCost: breakdown.timeCost,
        materialCost: breakdown.materialCost,
        margin: breakdown.margin,
      },
    };
  }
  return undefined;
}

function endpointUrl(): string {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}${QUOTE_ENDPOINT_PATH}`;
}

export function requestQuote(fileId: string): QuoteRequest {
  let socket: WebSocket | undefined;
  let closedByClient = false;

  const promise = new Promise<QuoteDone>((resolve, reject) => {
    const fail = (failure: QuoteFailure) => reject(failure);
    const ws = new WebSocket(endpointUrl());
    socket = ws;
    let settled = false;
    const settle = (action: () => void) => {
      if (settled || closedByClient) return;
      settled = true;
      action();
    };

    ws.onopen = () => ws.send(JSON.stringify({ type: "quote.request", fileId }));
    ws.onmessage = (event) => {
      const body = typeof event.data === "string" ? parseJson(event.data) : undefined;
      if (isRecord(body) && body.type === "quote.done") {
        const quote = toQuoteDone(body);
        if (quote) {
          settle(() => resolve(quote));
          return;
        }
      }
      if (isRecord(body) && body.type === "quote.error" && typeof body.code === "string") {
        const code = body.code;
        const message = typeof body.message === "string" ? body.message : "";
        settle(() => fail({ kind: "backend", code, message }));
        return;
      }
      settle(() => fail({ kind: "backend", code: UNPARSEABLE_ERROR_CODE, message: String(event.data) }));
    };
    // A socket that ends before any result is "connection lost", never "the model failed".
    ws.onerror = () => settle(() => fail({ kind: "connection_lost" }));
    ws.onclose = () => settle(() => fail({ kind: "connection_lost" }));
  });

  const close = () => {
    closedByClient = true;
    socket?.close();
  };

  return { promise, close };
}
