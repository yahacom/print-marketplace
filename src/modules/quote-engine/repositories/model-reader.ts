import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SAFE_FILE_ID } from "../../stl-upload/file-id.js";

const DEFAULT_STORAGE_DIR = "./storage/models";

export type NotFound = { notFound: true };

// Reads <file-id>.stl from the storage dir stl-upload writes to. A malformed
// id and a missing file return the same result so callers cannot tell them
// apart (AC-05, AC-06). Other fs errors (e.g. EACCES) propagate: they are
// operational failures, not "model missing".
export const readModel = async (fileId: string): Promise<Buffer | NotFound> => {
  if (!SAFE_FILE_ID.test(fileId)) {
    return { notFound: true };
  }

  const storageDir = process.env.STORAGE_DIR ?? DEFAULT_STORAGE_DIR;
  try {
    return await readFile(join(storageDir, `${fileId}.stl`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { notFound: true };
    }
    throw error;
  }
};
