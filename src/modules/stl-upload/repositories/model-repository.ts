import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SAFE_FILE_ID } from "../file-id.js";

const DEFAULT_STORAGE_DIR = "./storage/models";

const storageDir = (): string => process.env.STORAGE_DIR ?? DEFAULT_STORAGE_DIR;

// Local-filesystem storage (ADR-0003). The signature stays storage-agnostic so
// a later move to object storage does not touch callers.
export const saveModel = async (
  fileId: string,
  buffer: Buffer,
): Promise<void> => {
  if (!SAFE_FILE_ID.test(fileId)) {
    throw new Error("Invalid file-id");
  }

  await mkdir(storageDir(), { recursive: true });
  await writeFile(join(storageDir(), `${fileId}.stl`), buffer);
};

// Whether <fileId>.stl is stored. A malformed id is simply "not stored" (it
// never reaches the filesystem). Other fs errors (e.g. EACCES) propagate: they
// are operational failures, not "model missing".
export const modelExists = async (fileId: string): Promise<boolean> => {
  if (!SAFE_FILE_ID.test(fileId)) {
    return false;
  }

  try {
    await access(join(storageDir(), `${fileId}.stl`));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
};
