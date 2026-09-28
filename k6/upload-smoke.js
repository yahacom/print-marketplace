/* global __ENV */
// k6 smoke test for POST /api/v1/uploads (T13, PRD §6 latency/throughput).
// Run: k6 run k6/upload-smoke.js   (BASE_URL defaults to http://localhost:3000)
// The server must be started with UPLOAD_RATE_LIMIT_PER_MIN raised: k6 sends
// everything from one IP, and the default 30/min limit would return 429s.
import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// Load profile targets 8 req/s so the ≥5 req/s threshold has headroom for
// ramp-up and the tail of the run.
export const options = {
  scenarios: {
    upload: {
      executor: "constant-arrival-rate",
      rate: 8,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    // PRD §6: p95 upload-validate latency ≤ 10000 ms.
    http_req_duration: ["p(95)<=10000"],
    // PRD §6: throughput ≥ 5 req/s per instance.
    http_reqs: ["rate>=5"],
    // Latency/throughput numbers are meaningless if requests fail (e.g. 429).
    checks: ["rate==1"],
  },
};

// Representative model: ~2.5 MB binary STL (80-byte header, uint32 triangle
// count, 50 bytes per triangle). The service checks declarations only
// (ADR-0006), so triangle data is zero-filled.
const TRIANGLE_COUNT = 50000;
const stl = new ArrayBuffer(84 + TRIANGLE_COUNT * 50);
new DataView(stl).setUint32(80, TRIANGLE_COUNT, true);

export default function () {
  const res = http.post(`${BASE_URL}/api/v1/uploads`, {
    file: http.file(stl, "model.stl", "model/stl"),
  });

  check(res, {
    "status is 201": (r) => r.status === 201,
    "body has file_id": (r) => Boolean(r.json("file_id")),
  });
}
