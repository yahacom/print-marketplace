// fetch wrapper for the order-confirmation routes (T8, T9). Resolves on 2xx;
// rejects with an `OrderFailure` that `errors.ts` maps to user text.
import type { OrderFailure } from "./errors.js";

// Used when an error response carries no parseable `{code, message}` (e.g. a proxy's HTML 502 page).
const UNPARSEABLE_ERROR_CODE = "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function toBackendFailure(response: Response): Promise<OrderFailure> {
  const text = await response.text().catch(() => "");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  if (isRecord(body) && typeof body.code === "string" && typeof body.message === "string") {
    return { kind: "backend", status: response.status, code: body.code, message: body.message };
  }
  return { kind: "backend", status: response.status, code: UNPARSEABLE_ERROR_CODE, message: text };
}

async function postDecision(fileId: string, action: "confirm" | "decline"): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/orders/${encodeURIComponent(fileId)}/${action}`, {
      method: "POST",
    });
  } catch {
    throw { kind: "network" } satisfies OrderFailure;
  }
  if (!response.ok) {
    throw await toBackendFailure(response);
  }
}

export const confirmOrder = (fileId: string): Promise<void> => postDecision(fileId, "confirm");

export const declineOrder = (fileId: string): Promise<void> => postDecision(fileId, "decline");
