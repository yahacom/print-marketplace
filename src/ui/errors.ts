// Backend `{code, message}` and network/timeout failures → plain-language text (SAD §8).
// The backend `message` is carried on the failure for debugging but is never shown to the user.
export type UploadFailure =
  | { kind: "backend"; status: number; code: string; message: string }
  | { kind: "network" }
  | { kind: "timeout" };

const INVALID_FORMAT_TEXT =
  "We couldn't accept this file as an STL. Please check the file and try again.";
const FILE_TOO_LARGE_TEXT =
  "This file is too large to upload. Please choose a smaller STL file.";
const RATE_LIMITED_TEXT =
  "Too many uploads in a short time. Please wait a moment and try again.";
const UNREACHABLE_TEXT =
  "We couldn't reach the server. Please check your connection and try again.";
const GENERIC_TEXT = "Something went wrong on our side. Please try again.";

const BACKEND_CODE_TEXT = new Map([
  ["upload.invalid_format", INVALID_FORMAT_TEXT],
  ["upload.file_too_large", FILE_TOO_LARGE_TEXT],
  ["upload.rate_limited", RATE_LIMITED_TEXT],
]);

export function toUserMessage(failure: UploadFailure): string {
  if (failure.kind !== "backend") {
    return UNREACHABLE_TEXT;
  }
  return BACKEND_CODE_TEXT.get(failure.code) ?? GENERIC_TEXT;
}

// quote-engine failures (T12). `quote.error` pushes carry a backend `{code, message}`;
// like uploads, only the code selects fixed text and the message is never shown.
// `connection_lost` means the socket ended before any result arrived (ADR-0001):
// the slice itself may have succeeded or failed, so the wording must not blame the model.
export type QuoteFailure =
  | { kind: "backend"; code: string; message: string }
  | { kind: "connection_lost" };

const QUOTE_NOT_FOUND_TEXT =
  "We couldn't find your uploaded model. Please upload it again.";
const QUOTE_UNSLICABLE_TEXT =
  "We couldn't prepare this model for printing, so we can't quote it. Please check the model or try another file.";
const QUOTE_EXCEEDS_BUILD_VOLUME_TEXT =
  "This model is larger than our printer can handle. Please scale it down or choose a smaller model.";
const QUOTE_RATE_LIMITED_TEXT =
  "Too many quote requests in a short time. Please wait a moment and try again.";
const QUOTE_CONNECTION_LOST_TEXT =
  "The connection was lost while preparing your quote. Please try again.";

// `quote.not_found` is the single code for a missing and a not-owned file, so it gets
// one message: no wording difference that could reveal whether a file exists.
const QUOTE_CODE_TEXT = new Map([
  ["quote.not_found", QUOTE_NOT_FOUND_TEXT],
  ["quote.unslicable", QUOTE_UNSLICABLE_TEXT],
  ["quote.exceeds_build_volume", QUOTE_EXCEEDS_BUILD_VOLUME_TEXT],
  ["quote.rate_limited", QUOTE_RATE_LIMITED_TEXT],
]);

export function toQuoteUserMessage(failure: QuoteFailure): string {
  if (failure.kind === "connection_lost") {
    return QUOTE_CONNECTION_LOST_TEXT;
  }
  return QUOTE_CODE_TEXT.get(failure.code) ?? GENERIC_TEXT;
}

// order-confirmation failures (T17). Same discipline as uploads: the backend
// `{code, message}` selects fixed text and the message is never shown.
export type OrderFailure =
  | { kind: "backend"; status: number; code: string; message: string }
  | { kind: "network" };

const ORDER_NOT_FOUND_TEXT =
  "We couldn't find your quote. Please upload your model again.";
const ORDER_ALREADY_DECIDED_TEXT = "This quote already has a final decision.";
const ORDER_FILE_MISSING_TEXT =
  "Your model needs to be re-uploaded before an order can be placed.";

const ORDER_CODE_TEXT = new Map([
  ["order.not_found", ORDER_NOT_FOUND_TEXT],
  ["order.already_decided", ORDER_ALREADY_DECIDED_TEXT],
  ["order.file_missing", ORDER_FILE_MISSING_TEXT],
]);

export function toOrderUserMessage(failure: OrderFailure): string {
  if (failure.kind === "network") {
    return UNREACHABLE_TEXT;
  }
  return ORDER_CODE_TEXT.get(failure.code) ?? GENERIC_TEXT;
}
