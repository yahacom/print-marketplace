import { expect, it } from "vitest";
import { toOrderUserMessage, type OrderFailure } from "./errors.js";

const RAW_MESSAGE = "RAW-BACKEND-DETAIL: stack trace at /srv/app.js:42";

const backend = (status: number, code: string): OrderFailure => ({
  kind: "backend",
  status,
  code,
  message: RAW_MESSAGE,
});

it("maps each order code to its fixed text", () => {
  expect(toOrderUserMessage(backend(404, "order.not_found"))).toBe(
    "We couldn't find your quote. Please upload your model again.",
  );
  expect(toOrderUserMessage(backend(409, "order.already_decided"))).toBe(
    "This quote already has a final decision.",
  );
  expect(toOrderUserMessage(backend(409, "order.file_missing"))).toBe(
    "Your model needs to be re-uploaded before an order can be placed.",
  );
});

it("gives unknown codes and network failures their own non-code text", () => {
  const unknown = toOrderUserMessage(backend(500, "order.internal_error"));
  const network = toOrderUserMessage({ kind: "network" });

  expect(unknown).toBe("Something went wrong on our side. Please try again.");
  expect(network).toBe("We couldn't reach the server. Please check your connection and try again.");
});

it("never returns the raw backend message", () => {
  for (const code of ["order.not_found", "order.already_decided", "order.file_missing", "unknown", "x"]) {
    expect(toOrderUserMessage(backend(400, code))).not.toContain("RAW-BACKEND-DETAIL");
  }
});

it("does not resolve inherited object keys as backend codes", () => {
  expect(toOrderUserMessage(backend(500, "constructor"))).toBe(
    toOrderUserMessage(backend(500, "order.internal_error")),
  );
});
