import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

// Contract/integration suite (T10): real route + rate limiter + filesystem
// repository, nothing mocked. Bodies mirror the openapi.yaml examples.

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BOUNDARY = "----integration-boundary";

const INVALID_FORMAT_BODY = {
  code: "upload.invalid_format",
  message:
    "We couldn't accept this file as an STL. Please check the file and try again.",
};
const FILE_TOO_LARGE_BODY = {
  code: "upload.file_too_large",
  message: "This file is larger than the 50 MB upload limit.",
};
const RATE_LIMITED_BODY = {
  code: "upload.rate_limited",
  message:
    "Too many uploads from this connection. Please wait a moment and try again.",
};

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

const upload = (
  app: ReturnType<typeof buildApp>,
  body: Buffer,
  remoteAddress = "10.0.0.1",
) =>
  app.inject({
    method: "POST",
    url: "/api/v1/uploads",
    remoteAddress,
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
    payload: body,
  });

const validStl = (content = "solid cube\nendsolid cube\n") =>
  multipartBody("cube.stl", "model/stl", Buffer.from(content));

let storageDir: string;
let previousStorageDir: string | undefined;

beforeEach(async () => {
  storageDir = await mkdtemp(join(tmpdir(), "stl-upload-it-"));
  previousStorageDir = process.env.STORAGE_DIR;
  process.env.STORAGE_DIR = storageDir;
});

afterEach(async () => {
  if (previousStorageDir === undefined) {
    delete process.env.STORAGE_DIR;
  } else {
    process.env.STORAGE_DIR = previousStorageDir;
  }
  await rm(storageDir, { recursive: true, force: true });
});

describe("POST /api/v1/uploads contract", () => {
  it("AC-01: 201 UploadAccepted for a well-formed STL, and the file is stored", async () => {
    const res = await upload(buildApp(), validStl());

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(["file_id", "status"]);
    expect(body.status).toBe("valid");
    expect(body.file_id).toMatch(UUID_V4);
    expect(await readdir(storageDir)).toEqual([`${body.file_id}.stl`]);
  });

  it("AC-02: 400 upload.invalid_format for a wrong content-type; nothing stored", async () => {
    const res = await upload(
      buildApp(),
      multipartBody("cube.stl", "image/png", Buffer.from("solid cube")),
    );

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(INVALID_FORMAT_BODY);
    expect(await readdir(storageDir)).toEqual([]);
  });

  it("AC-02: 400 upload.invalid_format for a wrong extension; nothing stored", async () => {
    const res = await upload(
      buildApp(),
      multipartBody("cube.png", "model/stl", Buffer.from("solid cube")),
    );

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(INVALID_FORMAT_BODY);
    expect(await readdir(storageDir)).toEqual([]);
  });

  it("AC-02: 400 upload.invalid_format for an empty file; nothing stored", async () => {
    const res = await upload(
      buildApp(),
      multipartBody("empty.stl", "model/stl", Buffer.alloc(0)),
    );

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(INVALID_FORMAT_BODY);
    expect(await readdir(storageDir)).toEqual([]);
  });

  it("413: upload.file_too_large for a file over 50 MB; nothing stored", async () => {
    const res = await upload(
      buildApp(),
      multipartBody(
        "big.stl",
        "model/stl",
        Buffer.alloc(50 * 1024 * 1024 + 1),
      ),
    );

    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual(FILE_TOO_LARGE_BODY);
    expect(await readdir(storageDir)).toEqual([]);
  });

  it("429: upload.rate_limited on the 31st request from one IP; the 30th succeeds", async () => {
    const app = buildApp();

    for (let i = 1; i <= 30; i++) {
      expect((await upload(app, validStl())).statusCode).toBe(201);
    }

    const res = await upload(app, validStl());
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual(RATE_LIMITED_BODY);
    expect(await readdir(storageDir)).toHaveLength(30);
  });
});

describe("AC-04: unguessable file-id", () => {
  it("AC-04: byte-identical uploads with identical metadata get distinct v4 ids", async () => {
    const app = buildApp();
    const ids = new Set<string>();

    for (let i = 0; i < 5; i++) {
      const res = await upload(app, validStl());
      expect(res.statusCode).toBe(201);
      ids.add(res.json().file_id);
    }

    expect(ids.size).toBe(5);
    for (const id of ids) {
      expect(id).toMatch(UUID_V4);
    }
  });

  it("AC-04: file-id is not derived from the filename or the content hash", async () => {
    const content = Buffer.from("solid derivable\nendsolid derivable\n");
    const res = await upload(
      buildApp(),
      multipartBody("derivable-name.stl", "model/stl", content),
    );
    expect(res.statusCode).toBe(201);
    const fileId: string = res.json().file_id;

    const compact = fileId.replaceAll("-", "");
    for (const algorithm of ["md5", "sha1", "sha256"]) {
      const digest = createHash(algorithm).update(content).digest("hex");
      expect(digest.startsWith(compact)).toBe(false);
    }
    expect(fileId).not.toContain("derivable");
  });
});

describe("AC-05: quote-engine handoff", () => {
  it("AC-05: the stored file is readable off disk by the returned file-id with identical bytes", async () => {
    // Non-text bytes, so any encoding/normalisation on the way to disk shows up.
    const content = Buffer.from([0x00, 0xff, 0x0a, 0x0d, 0x80, 0x7f, 0x00]);
    const res = await upload(
      buildApp(),
      multipartBody("binary.stl", "application/sla", content),
    );

    expect(res.statusCode).toBe(201);
    const stored = await readFile(join(storageDir, `${res.json().file_id}.stl`));
    expect(stored.equals(content)).toBe(true);
  });
});
