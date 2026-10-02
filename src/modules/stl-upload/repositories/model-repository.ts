import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SAFE_FILE_ID } from "../file-id.js";

const DEFAULT_STORAGE_DIR = "./storage/models";

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
