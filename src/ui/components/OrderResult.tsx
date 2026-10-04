import { toOrderUserMessage, type OrderFailure } from "../errors.js";

export type OrderOutcome =
  | { outcome: "confirmed"; filename: string }
  | { outcome: "declined"; filename: string }
  | { outcome: "error"; failure: OrderFailure; filename: string };

// Final screen after a confirm/decline attempt (US-02, US-03, US-05). There is
// deliberately no action here that re-sends or reverses the decision. Only fixed
// text is rendered; an error shows the mapped text, never the raw backend message.
export function OrderResult(props: OrderOutcome) {
  if (props.outcome === "error") {
    return (
      <section data-testid="order-result" data-outcome="error" class="quote-card" role="alert">
        <p class="active-filename" data-testid="active-filename">{props.filename}</p>
        <p data-testid="order-result-message">{toOrderUserMessage(props.failure)}</p>
      </section>
    );
  }

  return (
    <section data-testid="order-result" data-outcome={props.outcome} class="quote-card">
      <p class="active-filename" data-testid="active-filename">{props.filename}</p>
      <p data-testid="order-result-message">
        {props.outcome === "confirmed" ? "Order confirmed" : "No order was placed"}
      </p>
    </section>
  );
}
