import { randomUUID } from "node:crypto";

// Single seam for file-id generation (ADR-0005): a UUID v4 that doubles as
// the sole access control for a stored model, so callers must not mint ids
// any other way.
export const generateFileId = (): string => randomUUID();
