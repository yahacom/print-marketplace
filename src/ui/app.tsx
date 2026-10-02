import { useState } from "preact/hooks";
import { UploadForm } from "./components/UploadForm.js";
import { QuoteResult } from "./components/QuoteResult.js";
import { UploadResult } from "./components/UploadResult.js";
import type { QuoteFailure, UploadFailure } from "./errors.js";
import type { QuoteDone } from "./quote-client.js";
import { submitUpload, type UploadProgressEvent } from "./upload-client.js";

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: UploadProgressEvent }
  | { status: "success"; filename: string }
  | { status: "error"; failure: UploadFailure }
  | { status: "quote_ready"; quote: QuoteDone }
  | { status: "quote_error"; failure: QuoteFailure };

export const transitions = {
  // `total` is clamped to 1 so the upload button's fill never divides by zero before the first real progress event.
  startUpload: (file: File): UploadState => ({
    status: "uploading",
    progress: { loaded: 0, total: Math.max(file.size, 1) },
  }),
  progress: (progress: UploadProgressEvent): UploadState => ({ status: "uploading", progress }),
  succeed: (filename: string): UploadState => ({ status: "success", filename }),
  fail: (failure: UploadFailure): UploadState => ({ status: "error", failure }),
  quoteReady: (quote: QuoteDone): UploadState => ({ status: "quote_ready", quote }),
  quoteFail: (failure: QuoteFailure): UploadState => ({ status: "quote_error", failure }),
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

  const backToStart = (
    <button type="button" class="button" onClick={() => setState(transitions.reset())}>
      Back to start
    </button>
  );

  switch (state.status) {
    case "idle":
      return <UploadForm onFileSelected={handleFileSelected} />;
    case "uploading":
      return <UploadForm onFileSelected={handleFileSelected} progress={state.progress} />;
    case "error":
      return <UploadForm onFileSelected={handleFileSelected} failure={state.failure} />;
    case "success":
      return (
        <>
          <UploadResult outcome="success" filename={state.filename} />
          {backToStart}
        </>
      );
    case "quote_ready":
      return (
        <>
          <QuoteResult outcome="success" quote={state.quote} />
          {backToStart}
        </>
      );
    case "quote_error":
      return (
        <>
          <QuoteResult outcome="error" failure={state.failure} />
          {backToStart}
        </>
      );
  }
}
