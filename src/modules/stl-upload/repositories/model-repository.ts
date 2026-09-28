import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_STORAGE_DIR = "./storage/models";

// The file-id becomes part of a filesystem path, so refuse anything that is
// not a plain id (no separators, no "..") even though callers mint it via
// generateFileId().
const SAFE_FILE_ID = /^[A-Za-z0-9-]+$/;

// Local-filesystem storage (ADR-0003). The signature stays storage-agnostic so
// a later move to object storage does not touch callers.
export const saveModel = async (
  fileId: string,
  buffer: Buffer,
): Promise<void> => {
  if (!SAFE_FILE_ID.test(fileId)) {
    throw new Error("Invalid file-id");
  }

  const storageDir = process.env.STORAGE_DIR ?? DEFAULT_STORAGE_DIR;
  await mkdir(storageDir, { recursive: true });
  await writeFile(join(storageDir, `${fileId}.stl`), buffer);
};
