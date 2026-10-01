// Shows real byte-transfer progress only (PRD §3: no fabricated or cosmetic progress).
// T3 rejects 0-byte files before an upload starts, so `total` is always > 0 here.
export function UploadProgress({ loaded, total }: { loaded: number; total: number }) {
  const percent = Math.min(100, Math.floor((loaded / total) * 100));

  return (
    <section data-testid="upload-progress">
      <progress value={loaded} max={total} aria-label="Upload progress" />
      <p data-testid="upload-progress-percent">{percent}%</p>
    </section>
  );
}
