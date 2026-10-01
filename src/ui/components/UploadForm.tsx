import { useState } from "preact/hooks";

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

export function UploadForm({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const [rejection, setRejection] = useState<Rejection | null>(null);

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

  return (
    <section data-testid="upload-form">
      <div
        data-testid="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const transfer = event.dataTransfer;
          if (transfer) {
            handleFiles(transfer.files, containsDirectory(transfer.items));
          }
        }}
      >
        <p>Drag and drop an STL file here, or</p>
        <input
          type="file"
          accept=".stl"
          aria-label="Choose an STL file"
          onChange={(event) => {
            const input = event.currentTarget;
            handleFiles(input.files ?? [], false);
            // Allow re-selecting the same file after a rejection.
            input.value = "";
          }}
        />
      </div>
      {rejection && <p role="alert">{REJECTION_TEXT[rejection]}</p>}
    </section>
  );
}
