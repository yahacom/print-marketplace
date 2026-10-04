import { expect, it } from "vitest";
import { buildApp } from "../../app.js";

// The alert rules in deploy/prometheus/order-confirmation-alerts.yml select on
// these exact route labels; this fails if a route rename silently breaks them.
it("labels the order routes by route pattern, never by the raw fileId", async () => {
  const app = buildApp();
  const badId = "not%20a%20real%20id";

  await app.inject({ url: `/api/v1/orders/${badId}` });
  await app.inject({ method: "POST", url: `/api/v1/orders/${badId}/confirm` });
  await app.inject({ method: "POST", url: `/api/v1/orders/${badId}/decline` });
  const { body } = await app.inject({ url: "/metrics" });

  expect(body).toContain('method="GET",route="/api/v1/orders/:fileId",status_code="404"');
  expect(body).toContain('method="POST",route="/api/v1/orders/:fileId/confirm",status_code="404"');
  expect(body).toContain('method="POST",route="/api/v1/orders/:fileId/decline",status_code="404"');
  expect(body).not.toContain("not%20a%20real");
});
