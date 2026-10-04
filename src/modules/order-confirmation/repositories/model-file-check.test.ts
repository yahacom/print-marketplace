import { beforeEach, expect, it, vi } from "vitest";

const modelExists = vi.fn();
vi.mock("../../stl-upload/repositories/model-repository.js", () => ({ modelExists }));

const { modelFileExists } = await import("./model-file-check.js");

beforeEach(() => {
  vi.clearAllMocks();
});

it("passes the file id to stl-upload's modelExists and returns its answer", async () => {
  modelExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

  expect(await modelFileExists("id-1")).toBe(true);
  expect(await modelFileExists("id-2")).toBe(false);
  expect(modelExists).toHaveBeenNthCalledWith(1, "id-1");
  expect(modelExists).toHaveBeenNthCalledWith(2, "id-2");
});

it("propagates an operational failure instead of reporting the file missing", async () => {
  modelExists.mockRejectedValue(new Error("EACCES"));

  await expect(modelFileExists("id")).rejects.toThrow("EACCES");
});
