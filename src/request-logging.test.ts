import { Writable } from "node:stream";
import { expect, it } from "vitest";
import { buildApp } from "./app.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function appWithCapturedLogs() {
  const lines: string[] = [];
  const logStream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(...chunk.toString().split("\n").filter(Boolean));
      callback();
    },
  });
  return { app: buildApp({ logStream }), lines };
}

const parseLine = (lines: string[], index: number) => JSON.parse(lines[index]!);

const multipartBody = (content: string) =>
  [
    "--b",
    'Content-Disposition: form-data; name="file"; filename="secret-name.stl"',
    "Content-Type: model/stl",
    "",
    content,
    "--b--",
    "",
  ].join("\r\n");

it("logs one structured line per request with a generated request_id", async () => {
  const { app, lines } = appWithCapturedLogs();

  await app.inject({ method: "GET", url: "/health?token=abc" });

  expect(lines).toHaveLength(1);
  const entry = parseLine(lines, 0);
  expect(entry).toMatchObject({
    method: "GET",
    path: "/health",
    status: 200,
    msg: "request completed",
  });
  expect(entry.request_id).toMatch(UUID_V4);
  expect(typeof entry.duration_ms).toBe("number");
  expect(lines[0]!).not.toContain("token=abc");
});

it("propagates a well-formed inbound x-request-id", async () => {
  const { app, lines } = appWithCapturedLogs();

  await app.inject({
    method: "GET",
    url: "/health",
    headers: { "x-request-id": "client-req-123" },
  });

  expect(parseLine(lines, 0).request_id).toBe("client-req-123");
});

it("replaces a malformed inbound x-request-id", async () => {
  const { app, lines } = appWithCapturedLogs();

  await app.inject({
    method: "GET",
    url: "/health",
    headers: { "x-request-id": "bad id\twith spaces" },
  });

  expect(parseLine(lines, 0).request_id).toMatch(UUID_V4);
});

it("does not log file content or filename on upload", async () => {
  const { app, lines } = appWithCapturedLogs();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/uploads",
    headers: { "content-type": "multipart/form-data; boundary=b" },
    payload: multipartBody("SUPER-SECRET-STL-BYTES"),
  });

  expect(res.statusCode).toBe(201);
  expect(lines).toHaveLength(1);
  expect(lines[0]!).not.toContain("SUPER-SECRET-STL-BYTES");
  expect(lines[0]!).not.toContain("secret-name");
  expect(parseLine(lines, 0)).toMatchObject({ path: "/api/v1/uploads", status: 201 });
});
