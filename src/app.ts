import Fastify from "fastify";
import { stlUploadModule } from "./modules/stl-upload/module.js";

export function buildApp() {
  const app = Fastify();

  app.get("/health", async () => ({ status: "ok" }));
  app.register(stlUploadModule);

  return app;
}
