import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SAFE_FILE_ID } from "../../stl-upload/file-id.js";

const DEFAULT_STORAGE_DIR = "./storage/models";

export type NotFound = { notFound: true };

const storagePath = (fileId: string): string =>
  join(process.env.STORAGE_DIR ?? DEFAULT_STORAGE_DIR, `${fileId}.stl`);

// Reads <file-id>.stl from the storage dir stl-upload writes to. A malformed
// id and a missing file return the same result so callers cannot tell them
// apart (AC-05, AC-06). Other fs errors (e.g. EACCES) propagate: they are
// operational failures, not "model missing".
export const readModel = async (fileId: string): Promise<Buffer | NotFound> => {
  if (!SAFE_FILE_ID.test(fileId)) {
    return { notFound: true };
  }

  try {
    return await readFile(storagePath(fileId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { notFound: true };
    }
    throw error;
  }
};

// Same lookup as readModel but returns the path instead of the bytes: the
// slicer (T4) takes a file path, and a model can be up to 50 MB, so reading it
// into memory only to discard it would be wasteful. The id is validated the
// same way, so the returned path is always inside the storage dir.
export const getModelPath = async (fileId: string): Promise<string | NotFound> => {
  if (!SAFE_FILE_ID.test(fileId)) {
    return { notFound: true };
  }

  const path = storagePath(fileId);
  try {
    await access(path);
    return path;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { notFound: true };
    }
    throw error;
  }
};
