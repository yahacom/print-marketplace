import { extname } from "node:path";
import { generateFileId } from "../file-id.js";
import { saveModel } from "../repositories/model-repository.js";

// Content types declared as acceptable for an STL in openapi.yaml.
const ACCEPTED_CONTENT_TYPES = new Set([
  "model/stl",
  "application/sla",
  "application/octet-stream",
]);

export type InvalidFormatReason =
  | "empty_file"
  | "unsupported_content_type"
  | "unsupported_extension";

export type UploadResult =
  | { kind: "valid"; fileId: string }
  | { kind: "invalid_format"; reason: InvalidFormatReason };

// Declaration-only check (ADR-0006): the bytes are never parsed as a mesh.
// Size limits (413) are enforced at the HTTP layer (T7).
const checkFormat = (
  buffer: Buffer,
  declaredContentType: string,
  filename: string,
): InvalidFormatReason | null => {
  if (buffer.length === 0) {
    return "empty_file";
  }

  // Drop parameters such as "; charset=binary" before comparing.
  const mediaType = declaredContentType.split(";")[0]?.trim().toLowerCase();
  if (!mediaType || !ACCEPTED_CONTENT_TYPES.has(mediaType)) {
    return "unsupported_content_type";
  }

  if (extname(filename).toLowerCase() !== ".stl") {
    return "unsupported_extension";
  }

  return null;
};

const storeModel = async (buffer: Buffer): Promise<string> => {
  const fileId = generateFileId();
  await saveModel(fileId, buffer);
  return fileId;
};

export const uploadAndValidate = async (
  buffer: Buffer,
  declaredContentType: string,
  filename: string,
): Promise<UploadResult> => {
  const reason = checkFormat(buffer, declaredContentType, filename);
  if (reason) {
    return { kind: "invalid_format", reason };
  }

  return { kind: "valid", fileId: await storeModel(buffer) };
};
