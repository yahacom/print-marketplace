import { toUserMessage, type UploadFailure } from "../errors.js";

// Only the current session's own just-completed submission is ever passed in (PRD AC-07):
// there is deliberately no file_id prop or lookup.
export type UploadOutcome =
  | { outcome: "success"; filename: string }
  | { outcome: "error"; failure: UploadFailure };

// The filename is rendered only as a JSX text node, so Preact escapes it (PRD AC-06).
// Never use dangerouslySetInnerHTML or raw DOM string insertion in this component.
export function UploadResult(props: UploadOutcome) {
  if (props.outcome === "success") {
    return (
      <section data-testid="upload-result" data-outcome="success">
        <p>
          <span data-testid="upload-result-filename">{props.filename}</span> was uploaded
          successfully.
        </p>
        <p>Your model is ready for the quote step.</p>
      </section>
    );
  }

  return (
    <section data-testid="upload-result" data-outcome="error" role="alert">
      <p data-testid="upload-result-message">{toUserMessage(props.failure)}</p>
    </section>
  );
}
