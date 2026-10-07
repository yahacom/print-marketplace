// fetch wrapper for the order-confirmation routes (T8, T9). Resolves on 2xx;
// rejects with an `OrderFailure` that `errors.ts` maps to user text.
import type { OrderFailure } from "./errors.js";

export type CustomerInfo = { name: string; phone: string; email: string };

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

async function postDecision(
  fileId: string,
  action: "confirm" | "decline",
  customer?: CustomerInfo,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/orders/${encodeURIComponent(fileId)}/${action}`, {
      method: "POST",
      ...(customer && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      }),
    });
  } catch {
    throw { kind: "network" } satisfies OrderFailure;
  }
  if (!response.ok) {
    throw await toBackendFailure(response);
  }
}

// Confirm requires contact details (Name/Phone/Email form on the quote screen); the
// server stores them on the draft order alongside the decision.
export const confirmOrder = (fileId: string, customer: CustomerInfo): Promise<void> =>
  postDecision(fileId, "confirm", customer);

export const declineOrder = (fileId: string): Promise<void> => postDecision(fileId, "decline");
