import { useState } from "preact/hooks";
import { UploadForm } from "./components/UploadForm.js";
import { UploadProgress } from "./components/UploadProgress.js";
import { UploadResult } from "./components/UploadResult.js";
import type { UploadFailure } from "./errors.js";
import { submitUpload, type UploadProgressEvent } from "./upload-client.js";

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: UploadProgressEvent }
  | { status: "success"; filename: string }
  | { status: "error"; failure: UploadFailure };

export const transitions = {
  // `total` is clamped to 1 so UploadProgress never divides by zero before the first real progress event.
  startUpload: (file: File): UploadState => ({
    status: "uploading",
    progress: { loaded: 0, total: Math.max(file.size, 1) },
  }),
  progress: (progress: UploadProgressEvent): UploadState => ({ status: "uploading", progress }),
  succeed: (filename: string): UploadState => ({ status: "success", filename }),
  fail: (failure: UploadFailure): UploadState => ({ status: "error", failure }),
  reset: (): UploadState => ({ status: "idle" }),
};

export function App({ initialState = { status: "idle" } }: { initialState?: UploadState }) {
  const [state, setState] = useState<UploadState>(initialState);

  function handleFileSelected(file: File) {
    setState(transitions.startUpload(file));
    submitUpload(file, (progress) => setState(transitions.progress(progress))).then(
      () => setState(transitions.succeed(file.name)),
      (failure: UploadFailure) => setState(transitions.fail(failure)),
    );
  }

  switch (state.status) {
    case "idle":
      return <UploadForm onFileSelected={handleFileSelected} />;
    case "uploading":
      return <UploadProgress loaded={state.progress.loaded} total={state.progress.total} />;
    case "success":
      return <UploadResult outcome="success" filename={state.filename} />;
    case "error":
      return <UploadResult outcome="error" failure={state.failure} />;
  }
}
