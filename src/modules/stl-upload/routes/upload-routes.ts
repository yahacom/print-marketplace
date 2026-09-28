import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { uploadAndValidate } from "../services/upload-service.js";
import { applyRateLimit } from "./rate-limit.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Response bodies copied from openapi.yaml examples (plain language, PRD §2).
const INVALID_FORMAT_BODY = {
  code: "upload.invalid_format",
  message:
    "We couldn't accept this file as an STL. Please check the file and try again.",
};
const FILE_TOO_LARGE_BODY = {
  code: "upload.file_too_large",
  message: "This file is larger than the 50 MB upload limit.",
};

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  // Registered first so over-limit requests are rejected before body parsing.
  applyRateLimit(app);

  // Multipart limits are enforced while streaming, so an oversized body is cut
  // off before it is fully buffered or handed to the service.
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  app.post("/api/v1/uploads", async (request, reply) => {
    // Not multipart at all -> nothing that can be declared as an STL.
    if (!request.isMultipart()) {
      return reply.code(400).send(INVALID_FORMAT_BODY);
    }

    const part = await request.file();
    if (!part || part.fieldname !== "file") {
      return reply.code(400).send(INVALID_FORMAT_BODY);
    }

    let buffer: Buffer;
    try {
      buffer = await part.toBuffer();
    } catch (error) {
      if (
        error instanceof app.multipartErrors.RequestFileTooLargeError
      ) {
        return reply.code(413).send(FILE_TOO_LARGE_BODY);
      }
      throw error;
    }

    const result = await uploadAndValidate(
      buffer,
      part.mimetype,
      part.filename,
    );
    if (result.kind === "invalid_format") {
      return reply.code(400).send(INVALID_FORMAT_BODY);
    }

    return reply.code(201).send({ file_id: result.fileId, status: "valid" });
  });
};
