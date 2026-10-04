// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, expect, it, vi } from "vitest";
import { QuoteResult } from "./QuoteResult.js";

const container = document.createElement("div");
document.body.appendChild(container);
afterEach(() => render(null, container));

const QUOTE = {
  price: 5.7,
  timeMinutes: 90,
  filamentGrams: 50,
  breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
};
const button = (testId: string) =>
  container.querySelector(`[data-testid=${testId}]`) as HTMLButtonElement | null;

it("renders no decision buttons without handlers", () => {
  render(<QuoteResult outcome="success" quote={QUOTE} filename="a.stl" />, container);

  expect(button("confirm-button")).toBeNull();
  expect(button("decline-button")).toBeNull();
});

it("wires Confirm and Decline to their handlers", () => {
  const onConfirm = vi.fn();
  const onDecline = vi.fn();
  render(<QuoteResult outcome="success" quote={QUOTE} filename="a.stl" onConfirm={onConfirm} onDecline={onDecline} />, container);

  button("confirm-button")?.click();
  button("decline-button")?.click();

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onDecline).toHaveBeenCalledTimes(1);
});

it("disables both buttons while deciding", () => {
  render(
    <QuoteResult outcome="success" quote={QUOTE} filename="a.stl" onConfirm={vi.fn()} onDecline={vi.fn()} deciding />,
    container,
  );

  expect(button("confirm-button")?.disabled).toBe(true);
  expect(button("decline-button")?.disabled).toBe(true);
});

it("does not show the buttons on a quote error", () => {
  render(<QuoteResult outcome="error" failure={{ kind: "connection_lost" }} filename="a.stl" />, container);

  expect(button("confirm-button")).toBeNull();
});
