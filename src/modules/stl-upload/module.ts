import type { FastifyPluginAsync } from "fastify";
import { uploadRoutes } from "./routes/upload-routes.js";

// Self-wiring entry for the stl-upload module (SAD §5, ADR-0004).
// Layers: routes/ (HTTP), services/ (upload use case), repositories/ (local
// filesystem storage). Later tasks register their pieces here.
export const stlUploadModule: FastifyPluginAsync = async (app) => {
  await app.register(uploadRoutes);
};
