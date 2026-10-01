// Promise wrapper over XMLHttpRequest (ADR-0003): fetch() has no dependable upload-progress event.
// Resolves with the 2xx body; rejects with an `UploadFailure` that `errors.ts` maps to user text.
import type { UploadFailure } from "./errors.js";

export interface UploadAccepted {
  file_id: string;
  status: string;
}

export interface UploadProgressEvent {
  loaded: number;
  total: number;
}

const UPLOAD_ENDPOINT = "/api/v1/uploads";
const UPLOAD_TIMEOUT_MS = 120_000;

// Used when an error response carries no parseable `{code, message}` (e.g. a proxy's HTML 502 page).
const UNPARSEABLE_ERROR_CODE = "unknown";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toBackendFailure(status: number, responseText: string): UploadFailure {
  const body = parseJson(responseText);
  if (isRecord(body) && typeof body.code === "string" && typeof body.message === "string") {
    return { kind: "backend", status, code: body.code, message: body.message };
  }
  return { kind: "backend", status, code: UNPARSEABLE_ERROR_CODE, message: responseText };
}

export function submitUpload(
  file: File,
  onProgress: (event: UploadProgressEvent) => void,
): Promise<UploadAccepted> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_ENDPOINT);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress({ loaded: event.loaded, total: event.total });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const body = parseJson(xhr.responseText);
        if (isRecord(body) && typeof body.file_id === "string" && typeof body.status === "string") {
          resolve({ file_id: body.file_id, status: body.status });
          return;
        }
      }
      // Non-2xx, or a 2xx whose body is not the documented `{file_id, status}`.
      reject(toBackendFailure(xhr.status, xhr.responseText));
    };
    xhr.onerror = () => reject({ kind: "network" } satisfies UploadFailure);
    xhr.ontimeout = () => reject({ kind: "timeout" } satisfies UploadFailure);

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
