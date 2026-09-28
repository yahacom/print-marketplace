import type { FastifyPluginAsync } from "fastify";

// Self-wiring entry for the stl-upload module (SAD §5, ADR-0004).
// Layers are empty for now: routes/ (HTTP), services/ (upload use case),
// repositories/ (local filesystem storage). Later tasks register their
// pieces here: repository -> service -> route.
export const stlUploadModule: FastifyPluginAsync = async () => {};
