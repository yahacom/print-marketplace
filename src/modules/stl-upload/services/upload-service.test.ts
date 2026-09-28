import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveModel } from "../repositories/model-repository.js";
import { uploadAndValidate } from "./upload-service.js";

vi.mock("../repositories/model-repository.js", () => ({
  saveModel: vi.fn().mockResolvedValue(undefined),
}));

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bytes = Buffer.from("solid cube");

beforeEach(() => {
  vi.mocked(saveModel).mockClear();
});

describe("uploadAndValidate", () => {
  it("valid: returns a file-id and saves the bytes under it", async () => {
    const result = await uploadAndValidate(bytes, "model/stl", "cube.stl");

    expect(result.kind).toBe("valid");
    if (result.kind !== "valid") return;
    expect(result.fileId).toMatch(UUID_V4);
    expect(saveModel).toHaveBeenCalledTimes(1);
    expect(saveModel).toHaveBeenCalledWith(result.fileId, bytes);
  });

  it("valid: accepts octet-stream with parameters and an upper-case extension", async () => {
    const result = await uploadAndValidate(
      bytes,
      "Application/Octet-Stream; charset=binary",
      "CUBE.STL",
    );

    expect(result.kind).toBe("valid");
    expect(saveModel).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["wrong content-type", "image/png", "cube.stl", "unsupported_content_type"],
    ["missing content-type", "", "cube.stl", "unsupported_content_type"],
    ["wrong extension", "model/stl", "cube.obj", "unsupported_extension"],
    ["missing extension", "model/stl", "cube", "unsupported_extension"],
  ])(
    "invalid_format: %s does not call saveModel",
    async (_case, contentType, filename, reason) => {
      const result = await uploadAndValidate(bytes, contentType, filename);

      expect(result).toEqual({ kind: "invalid_format", reason });
      expect(saveModel).not.toHaveBeenCalled();
    },
  );

  it("invalid_format: empty file does not call saveModel", async () => {
    const result = await uploadAndValidate(
      Buffer.alloc(0),
      "model/stl",
      "cube.stl",
    );

    expect(result).toEqual({ kind: "invalid_format", reason: "empty_file" });
    expect(saveModel).not.toHaveBeenCalled();
  });
});
