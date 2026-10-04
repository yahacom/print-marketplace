/* global __ENV */
// k6 load test for the order-confirmation routes (T13, PRD §6, SAD §10 QG-2).
// Run: k6 run k6/order-load.js   (BASE_URL defaults to http://localhost:3000)
// Needs a server whose draft orders 00000000-0000-4000-8000-<index, 12 digits>
// exist (index 0..SEED_COUNT-1; even indices also have a model file) and with
// ORDER_RATE_LIMIT_PER_MIN raised: k6 sends everything from one IP, and the
// default 10/min limit would return 429s. CI uses
// src/modules/order-confirmation/load-test-server.ts, which seeds exactly that.
import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SEED_COUNT = Number(__ENV.SEED_COUNT || 5000);

const fileIdAt = (index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

// Two scenarios of 12 req/s each = 24 req/s in total, above the ≥20 req/s
// target. Writes use a fresh order per iteration (a repeat would be a 409, not
// a write): even index -> confirm, odd -> decline.
export const options = {
  scenarios: {
    writes: {
      executor: "constant-arrival-rate",
      exec: "write",
      rate: 12,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
    reads: {
      executor: "constant-arrival-rate",
      exec: "read",
      rate: 12,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    // PRD §6: p95 confirm/decline write ≤ 300 ms.
    "http_req_duration{kind:write}": ["p(95)<=300"],
    // PRD §6: p95 order-state read ≤ 200 ms. This retargets the original
    // "quote-summary display" NFR onto T7's GET (SAD §11 open question).
    "http_req_duration{kind:read}": ["p(95)<=200"],
    // PRD §6: throughput ≥ 20 req/s per instance.
    http_reqs: ["rate>=20"],
    // Latency numbers are meaningless if requests fail (e.g. 429, 409).
    checks: ["rate==1"],
  },
};

export function write() {
  const index = exec.scenario.iterationInTest;
  if (index >= SEED_COUNT) throw new Error("SEED_COUNT too small for the write scenario");

  const action = index % 2 === 0 ? "confirm" : "decline";
  const res = http.post(`${BASE_URL}/api/v1/orders/${fileIdAt(index)}/${action}`, null, {
    tags: { kind: "write" },
  });

  check(res, {
    "write status is 201 (confirm) or 200 (decline)": (r) => r.status === (action === "confirm" ? 201 : 200),
  });
}

export function read() {
  const index = exec.scenario.iterationInTest % SEED_COUNT;
  const res = http.get(`${BASE_URL}/api/v1/orders/${fileIdAt(index)}`, { tags: { kind: "read" } });

  check(res, {
    "read status is 200": (r) => r.status === 200,
    "body has a state": (r) => ["ready", "decided"].includes(r.json("state")),
  });
}
