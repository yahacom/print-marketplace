import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../app.js";
import { saveModel } from "../repositories/model-repository.js";

vi.mock("../repositories/model-repository.js", () => ({
  saveModel: vi.fn().mockResolvedValue(undefined),
}));

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BOUNDARY = "----test-boundary";

const multipartBody = (
  filename: string,
  contentType: string,
  content: Buffer,
) =>
  Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);

const upload = (body: Buffer) =>
  buildApp().inject({
    method: "POST",
    url: "/api/v1/uploads",
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
    payload: body,
  });

beforeEach(() => {
  vi.mocked(saveModel).mockClear();
});

describe("POST /api/v1/uploads", () => {
  it("201: stores a declared STL and returns its file-id", async () => {
    const res = await upload(
      multipartBody("cube.stl", "model/stl", Buffer.from("solid cube")),
    );

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("valid");
    expect(body.file_id).toMatch(UUID_V4);
    expect(saveModel).toHaveBeenCalledTimes(1);
  });

  it("400: wrong content-type returns the openapi error body", async () => {
    const res = await upload(
      multipartBody("cube.stl", "image/png", Buffer.from("solid cube")),
    );

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      code: "upload.invalid_format",
      message:
        "We couldn't accept this file as an STL. Please check the file and try again.",
    });
    expect(saveModel).not.toHaveBeenCalled();
  });

  it("400: a non-multipart request is rejected as invalid format", async () => {
    const res = await buildApp().inject({
      method: "POST",
      url: "/api/v1/uploads",
      payload: { hello: "world" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("upload.invalid_format");
  });

  it("413: file over 50 MB returns the openapi error body", async () => {
    const res = await upload(
      multipartBody(
        "big.stl",
        "model/stl",
        Buffer.alloc(50 * 1024 * 1024 + 1),
      ),
    );

    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({
      code: "upload.file_too_large",
      message: "This file is larger than the 50 MB upload limit.",
    });
    expect(saveModel).not.toHaveBeenCalled();
  });
});
