import { expect, it } from "vitest";
import { buildApp } from "./app.js";

const multipartBody = [
  "--b",
  'Content-Disposition: form-data; name="file"; filename="a.stl"',
  "Content-Type: model/stl",
  "",
  "solid x",
  "--b--",
  "",
].join("\r\n");

it("exposes a per-request duration histogram labelled by route pattern and status", async () => {
  const app = buildApp();

  await app.inject({
    method: "POST",
    url: "/api/v1/uploads",
    headers: { "content-type": "multipart/form-data; boundary=b" },
    payload: multipartBody,
  });
  const res = await app.inject({ method: "GET", url: "/metrics" });

  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toContain("text/plain");
  const labels = 'method="POST",route="/api/v1/uploads",status_code="201"';
  expect(res.body).toContain("# TYPE http_request_duration_seconds histogram");
  expect(res.body).toContain(`http_request_duration_seconds_bucket{${labels},le="10"} 1`);
  expect(res.body).toContain(`http_request_duration_seconds_bucket{${labels},le="+Inf"} 1`);
  expect(res.body).toContain(`http_request_duration_seconds_count{${labels}} 1`);
});

it("does not put the raw url or query string into metric labels", async () => {
  const app = buildApp();

  await app.inject({ method: "GET", url: "/no-such-path?token=abc" });
  const res = await app.inject({ method: "GET", url: "/metrics" });

  expect(res.body).toContain('route="unmatched",status_code="404"');
  expect(res.body).not.toContain("no-such-path");
  expect(res.body).not.toContain("token=abc");
});
