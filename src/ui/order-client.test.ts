import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { confirmOrder, declineOrder } from "./order-client.js";

const FILE_ID = "11111111-1111-4111-8111-111111111111";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

it("confirmOrder POSTs to the confirm route and resolves on 201", async () => {
  fetchMock.mockResolvedValue(jsonResponse(201, { status: "confirmed" }));

  await expect(confirmOrder(FILE_ID)).resolves.toBeUndefined();

  expect(fetchMock).toHaveBeenCalledWith(`/api/v1/orders/${FILE_ID}/confirm`, { method: "POST" });
});

it("declineOrder POSTs to the decline route and resolves on 200", async () => {
  fetchMock.mockResolvedValue(jsonResponse(200, { status: "declined" }));

  await expect(declineOrder(FILE_ID)).resolves.toBeUndefined();

  expect(fetchMock).toHaveBeenCalledWith(`/api/v1/orders/${FILE_ID}/decline`, { method: "POST" });
});

it.each([
  [404, "order.not_found"],
  [409, "order.already_decided"],
  [409, "order.file_missing"],
])("rejects a %i with the backend code %s", async (status, code) => {
  fetchMock.mockResolvedValue(jsonResponse(status, { code, message: "raw detail" }));

  await expect(confirmOrder(FILE_ID)).rejects.toEqual({
    kind: "backend",
    status,
    code,
    message: "raw detail",
  });
});

it("rejects a non-JSON error response (e.g. a proxy 502) with code unknown", async () => {
  fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));

  await expect(declineOrder(FILE_ID)).rejects.toMatchObject({
    kind: "backend",
    status: 502,
    code: "unknown",
  });
});

it("rejects a network failure with { kind: network }", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

  await expect(confirmOrder(FILE_ID)).rejects.toEqual({ kind: "network" });
  await expect(declineOrder(FILE_ID)).rejects.toEqual({ kind: "network" });
});
