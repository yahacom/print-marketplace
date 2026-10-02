// Wait state between a finished upload and the quote push (T16). The only
// interactive element is "Back to start"; it abandons the request.
export function SlicingWait({ onBackToStart }: { onBackToStart: () => void }) {
  return (
    <section data-testid="slicing-wait">
      <p role="status" data-testid="slicing-indicator">
        Slicing...
      </p>
      <button type="button" class="button" onClick={onBackToStart}>
        Back to start
      </button>
    </section>
  );
}
