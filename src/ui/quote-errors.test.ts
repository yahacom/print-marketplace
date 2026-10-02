import { expect, it } from "vitest";
import { toQuoteUserMessage, type QuoteFailure } from "./errors.js";

const RAW_MESSAGE = "RAW-BACKEND-DETAIL: stack trace at /srv/app.js:42";
const backend = (code: string): QuoteFailure => ({ kind: "backend", code, message: RAW_MESSAGE });

const failures = {
  notFound: backend("quote.not_found"),
  unslicable: backend("quote.unslicable"),
  exceedsBuildVolume: backend("quote.exceeds_build_volume"),
  rateLimited: backend("quote.rate_limited"),
  unknownCode: backend("quote.internal_error"),
  connectionLost: { kind: "connection_lost" },
} satisfies Record<string, QuoteFailure>;

it("maps the four documented codes, an unknown code and a lost connection to 6 distinct messages", () => {
  expect(new Set(Object.values(failures).map(toQuoteUserMessage)).size).toBe(6);
});

it("never includes the raw backend message", () => {
  for (const failure of Object.values(failures)) {
    expect(toQuoteUserMessage(failure)).not.toContain("RAW-BACKEND-DETAIL");
  }
});

it("AC-ui-4: the connection-lost text does not claim the model failed", () => {
  const text = toQuoteUserMessage(failures.connectionLost).toLowerCase();

  expect(text).toContain("connection");
  expect(text).not.toMatch(/model|slice|print/);
});

it("gives a missing and a malformed/not-owned file the same message (one backend code)", () => {
  expect(toQuoteUserMessage(backend("quote.not_found"))).toBe(toQuoteUserMessage(failures.notFound));
});
