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
