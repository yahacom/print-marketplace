import { useEffect, useRef, useState } from "preact/hooks";
import { UploadForm } from "./components/UploadForm.js";
import { QuoteResult } from "./components/QuoteResult.js";
import { SlicingWait } from "./components/SlicingWait.js";
import { UploadResult } from "./components/UploadResult.js";
import type { QuoteFailure, UploadFailure } from "./errors.js";
import type { QuoteDone, QuoteRequest } from "./quote-client.js";
import { submitUpload, type UploadProgressEvent } from "./upload-client.js";

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: UploadProgressEvent; filename: string }
  | { status: "success"; filename: string }
  | { status: "error"; failure: UploadFailure }
  | { status: "slicing"; filename: string }
  | { status: "quote_ready"; quote: QuoteDone; filename: string }
  | { status: "quote_error"; failure: QuoteFailure; filename: string };

export const transitions = {
  // `total` is clamped to 1 so the upload button's fill never divides by zero before the first real progress event.
  startUpload: (file: File): UploadState => ({
    status: "uploading",
    progress: { loaded: 0, total: Math.max(file.size, 1) },
    filename: file.name,
  }),
  progress: (filename: string, progress: UploadProgressEvent): UploadState => ({
    status: "uploading",
    progress,
    filename,
  }),
  succeed: (filename: string): UploadState => ({ status: "success", filename }),
  fail: (failure: UploadFailure): UploadState => ({ status: "error", failure }),
  startSlicing: (filename: string): UploadState => ({ status: "slicing", filename }),
  quoteReady: (quote: QuoteDone, filename: string): UploadState => ({
    status: "quote_ready",
    quote,
    filename,
  }),
  quoteFail: (failure: QuoteFailure, filename: string): UploadState => ({
    status: "quote_error",
    failure,
    filename,
  }),
  reset: (): UploadState => ({ status: "idle" }),
};

interface AppProps {
  initialState?: UploadState;
  // When given, a successful upload automatically requests a quote for the returned file-id
  // and enters `slicing` (T16). main.tsx passes the real WebSocket client; without it the
  // flow stops at the upload-success screen.
  startQuote?: (fileId: string, filename: string) => QuoteRequest;
}

export function App({ initialState = { status: "idle" }, startQuote }: AppProps) {
  const [state, setState] = useState<UploadState>(initialState);
  // The live quote request, if any. Results are applied only while it is still this
  // object, so a cancelled or replaced request can never write into a later flow (AC-ws-5).
  const activeQuote = useRef<QuoteRequest | null>(null);

  // Leaving the page closes the socket, which makes the server cancel the slice.
  useEffect(() => () => activeQuote.current?.close(), []);

  function beginQuote(
    fileId: string,
    filename: string,
    start: (fileId: string, filename: string) => QuoteRequest,
  ) {
    const request = start(fileId, filename);
    activeQuote.current = request;
    setState(transitions.startSlicing(filename));
    request.promise.then(
      (quote) => {
        if (activeQuote.current !== request) return;
        activeQuote.current = null;
        setState(transitions.quoteReady(quote, filename));
      },
      (failure: QuoteFailure) => {
        if (activeQuote.current !== request) return;
        activeQuote.current = null;
        setState(transitions.quoteFail(failure, filename));
      },
    );
  }

  // Closes the socket and returns to the form without waiting for the server (AC-ws-3).
  // Clearing the ref first means a result that races the click is discarded.
  function cancelQuote() {
    const request = activeQuote.current;
    activeQuote.current = null;
    request?.close();
    setState(transitions.reset());
  }

  function handleFileSelected(file: File) {
    setState(transitions.startUpload(file));
    submitUpload(file, (progress) => setState(transitions.progress(file.name, progress))).then(
      (accepted) =>
        startQuote
          ? beginQuote(accepted.file_id, file.name, startQuote)
          : setState(transitions.succeed(file.name)),
      (failure: UploadFailure) => setState(transitions.fail(failure)),
    );
  }

  const backToStart = (
    <button type="button" class="button" onClick={() => setState(transitions.reset())}>
      Back to start
    </button>
  );

  const filenameBanner = (filename: string) => (
    <p class="active-filename" data-testid="active-filename">{filename}</p>
  );

  switch (state.status) {
    case "idle":
      return <UploadForm onFileSelected={handleFileSelected} />;
    case "uploading":
      return (
        <>
          {filenameBanner(state.filename)}
          <UploadForm onFileSelected={handleFileSelected} progress={state.progress} />
        </>
      );
    case "error":
      return <UploadForm onFileSelected={handleFileSelected} failure={state.failure} />;
    case "success":
      return (
        <>
          <UploadResult outcome="success" filename={state.filename} />
          {backToStart}
        </>
      );
    case "slicing":
      return (
        <>
          {filenameBanner(state.filename)}
          <SlicingWait onBackToStart={cancelQuote} />
        </>
      );
    case "quote_ready":
      return (
        <>
          <QuoteResult outcome="success" quote={state.quote} filename={state.filename} />
          {backToStart}
        </>
      );
    case "quote_error":
      return (
        <>
          <QuoteResult outcome="error" failure={state.failure} filename={state.filename} />
          {backToStart}
        </>
      );
  }
}
