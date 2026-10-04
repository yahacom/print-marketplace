import { modelExists } from "../../stl-upload/repositories/model-repository.js";

// AC-05: has the user's uploaded model file been removed since the quote?
// stl-upload is the only module order-confirmation calls in-process
// (ADR-0002/0008); this adapter is the single point of contact, and the seam
// the domain service takes a fake through.
export type ModelFileCheck = (fileId: string) => Promise<boolean>;

export const modelFileExists: ModelFileCheck = (fileId) => modelExists(fileId);
