import { toQuoteUserMessage, type QuoteFailure } from "../errors.js";
import type { QuoteDone } from "../quote-client.js";

export type QuoteOutcome =
  | { outcome: "success"; quote: QuoteDone; filename: string }
  | { outcome: "error"; failure: QuoteFailure; filename: string };

// Pricing is configured in USD (config/pricing.json).
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Only numbers from the backend and fixed text are rendered, as JSX text nodes
// (never dangerouslySetInnerHTML). An error shows the mapped text, never the raw backend message.
export function QuoteResult(props: QuoteOutcome) {
  if (props.outcome === "error") {
    return (
      <section data-testid="quote-result" data-outcome="error" class="quote-card" role="alert">
        <p class="active-filename" data-testid="active-filename">{props.filename}</p>
        <p data-testid="quote-result-message">{toQuoteUserMessage(props.failure)}</p>
      </section>
    );
  }

  const { price, timeMinutes, filamentGrams } = props.quote;
  return (
    <section data-testid="quote-result" data-outcome="success" class="quote-card">
      <p class="active-filename" data-testid="active-filename">{props.filename}</p>
      <p>
        Your quote: <strong data-testid="quote-price">{usd.format(price)}</strong>
      </p>
      <p>
        Print time: <span data-testid="quote-time">{formatDuration(timeMinutes)}</span>
        {" · "}
        Filament: <span data-testid="quote-filament">{filamentGrams.toFixed(1)} g</span>
      </p>
    </section>
  );
}
