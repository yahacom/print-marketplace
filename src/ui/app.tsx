import { useState } from "preact/hooks";

export type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success" }
  | { status: "error" };

export const transitions = {
  startUpload: (): UploadState => ({ status: "uploading" }),
  succeed: (): UploadState => ({ status: "success" }),
  fail: (): UploadState => ({ status: "error" }),
  reset: (): UploadState => ({ status: "idle" }),
};

// Stub children — replaced by UploadForm (T3), UploadProgress (T6), UploadResult (T7) in T8.
function UploadFormStub() {
  return <section data-testid="upload-form">upload form</section>;
}

function UploadProgressStub() {
  return <section data-testid="upload-progress">upload progress</section>;
}

function UploadResultStub({ outcome }: { outcome: "success" | "error" }) {
  return (
    <section data-testid="upload-result" data-outcome={outcome}>
      upload {outcome}
    </section>
  );
}

export function App({ initialState = { status: "idle" } }: { initialState?: UploadState }) {
  // setState is unused until T8 wires the transitions to the form and upload client.
  const [state] = useState<UploadState>(initialState);

  switch (state.status) {
    case "idle":
      return <UploadFormStub />;
    case "uploading":
      return <UploadProgressStub />;
    case "success":
    case "error":
      return <UploadResultStub outcome={state.status} />;
  }
}
