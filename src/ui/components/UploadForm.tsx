import { useRef, useState } from "preact/hooks";
import type { UploadFailure } from "../errors.js";
import type { UploadProgressEvent } from "../upload-client.js";
import { UploadResult } from "./UploadResult.js";

// Mirrors the backend limit (MAX_UPLOAD_BYTES in upload-routes.ts); checked here to avoid a doomed upload.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const MULTIPLE_FILES_TEXT = "Only one model can be uploaded at a time. Please choose a single STL file.";
const FILE_TOO_LARGE_TEXT = "This file is too large to upload. Please choose a smaller STL file.";

type Rejection = "multiple" | "too_large";

const REJECTION_TEXT: Record<Rejection, string> = {
  multiple: MULTIPLE_FILES_TEXT,
  too_large: FILE_TOO_LARGE_TEXT,
};

// A dropped folder surfaces as a directory entry (or as a file-less item), so it counts as "not one file".
function containsDirectory(items: DataTransferItemList | undefined): boolean {
  return [...(items ?? [])].some((item) => item.webkitGetAsEntry?.()?.isDirectory === true);
}

interface UploadFormProps {
  onFileSelected: (file: File) => void;
  // Present only while an upload is in flight: disables the controls and drives the button fill.
  progress?: UploadProgressEvent;
  // The last upload's failure; the controls stay enabled so the user can pick another file.
  failure?: UploadFailure;
}

export function UploadForm({ onFileSelected, progress, failure }: UploadFormProps) {
  const [rejection, setRejection] = useState<Rejection | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = progress !== undefined;

  function handleFiles(files: ArrayLike<File>, hasDirectory: boolean) {
    const file = files[0];
    if (hasDirectory || files.length !== 1 || !file) {
      setRejection("multiple");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setRejection("too_large");
      return;
    }
    setRejection(null);
    onFileSelected(file);
  }

  const fillPercent = progress ? Math.min(100, (progress.loaded / progress.total) * 100) : 0;

  return (
    <section data-testid="upload-form">
      <div
        data-testid="drop-zone"
        class={dragging ? "drop-zone--active" : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const transfer = event.dataTransfer;
          if (transfer && !uploading) {
            handleFiles(transfer.files, containsDirectory(transfer.items));
          }
        }}
      >
        <p class="drop-zone__hint">Drag and drop an STL file here, or</p>
        <input
          type="file"
          accept=".stl"
          aria-label="Choose an STL file"
          hidden
          ref={inputRef}
          disabled={uploading}
          onChange={(event) => {
            const input = event.currentTarget;
            handleFiles(input.files ?? [], false);
            // Allow re-selecting the same file after a rejection.
            input.value = "";
          }}
        />
        <button
          type="button"
          class="button"
          data-testid="upload-button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading && (
            <span
              class="button__fill"
              data-testid="upload-button-fill"
              style={{ width: `${fillPercent}%` }}
            />
          )}
          <span class="button__label">{uploading ? "Uploading..." : "Upload"}</span>
        </button>
      </div>
      <div class="upload-status">
        {uploading && <p role="status">Uploading your model. Please keep this page open.</p>}
        {!uploading && rejection && <p role="alert">{REJECTION_TEXT[rejection]}</p>}
        {!uploading && !rejection && failure && <UploadResult outcome="error" failure={failure} />}
      </div>
    </section>
  );
}
