import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { buildApp } from "./app.js";

it("responds ok on the health-check route", async () => {
  const res = await buildApp().inject({ method: "GET", url: "/health" });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: "ok" });
});

it("serves the built UI index.html at GET /", async () => {
  const uiRoot = mkdtempSync(join(tmpdir(), "dist-ui-"));
  writeFileSync(join(uiRoot, "index.html"), "<!doctype html><title>upload</title>");

  const res = await buildApp({ uiRoot }).inject({ method: "GET", url: "/" });

  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toContain("text/html");
  expect(res.body).toContain("<title>upload</title>");
});
