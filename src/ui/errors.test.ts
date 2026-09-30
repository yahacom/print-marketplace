import { expect, it } from "vitest";
import { toUserMessage, type UploadFailure } from "./errors.js";

const RAW_MESSAGE = "RAW-BACKEND-DETAIL: stack trace at /srv/app.js:42";

function backend(status: number, code: string): UploadFailure {
  return { kind: "backend", status, code, message: RAW_MESSAGE };
}

const failures = {
  invalidFormat: backend(400, "upload.invalid_format"),
  fileTooLarge: backend(413, "upload.file_too_large"),
  rateLimited: backend(429, "upload.rate_limited"),
  unrecognized5xx: backend(500, "internal.unexpected"),
  network: { kind: "network" },
} satisfies Record<string, UploadFailure>;

it("maps the 3 documented backend codes, unrecognized 5xx and network failure to 5 distinct messages", () => {
  const messages = Object.values(failures).map(toUserMessage);

  expect(new Set(messages).size).toBe(5);
});

it("never includes the raw backend message", () => {
  for (const failure of Object.values(failures)) {
    expect(toUserMessage(failure)).not.toContain("RAW-BACKEND-DETAIL");
  }
});

it("keeps the file-too-large message distinct from invalid-format (AC-03)", () => {
  expect(toUserMessage(failures.fileTooLarge)).not.toBe(
    toUserMessage(failures.invalidFormat),
  );
});

it("maps timeout to the same unreachable message as a network failure (AC-04)", () => {
  expect(toUserMessage({ kind: "timeout" })).toBe(toUserMessage(failures.network));
});

it("does not resolve inherited object keys as backend codes", () => {
  expect(toUserMessage(backend(500, "constructor"))).toBe(
    toUserMessage(failures.unrecognized5xx),
  );
});
