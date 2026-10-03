// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, expect, it } from "vitest";
import { QuoteResult } from "./QuoteResult.js";

const container = document.createElement("div");
document.body.appendChild(container);
afterEach(() => render(null, container));

const text = (testId: string) => container.querySelector(`[data-testid=${testId}]`)?.textContent;

const QUOTE = {
  price: 5.7,
  timeMinutes: 90,
  filamentGrams: 50,
  breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
};

it("AC-ui-1: shows the price and the print time", () => {
  render(<QuoteResult outcome="success" quote={QUOTE} filename="a.stl" />, container);

  expect(text("quote-price")).toBe("$5.70");
  expect(text("quote-time")).toBe("1 h 30 min");
  expect(text("quote-filament")).toBe("50.0 g");
  expect(
    container.querySelector("[data-testid=quote-result] [data-testid=active-filename]")?.textContent,
  ).toBe("a.stl");
});

it("AC-ui-2: does not show the internal cost breakdown", () => {
  render(<QuoteResult outcome="success" quote={QUOTE} filename="a.stl" />, container);

  expect(container.querySelector("[data-testid=quote-breakdown]")).toBeNull();
  expect(container.querySelector("[data-testid=quote-time-cost]")).toBeNull();
  expect(container.querySelector("[data-testid=quote-material-cost]")).toBeNull();
  expect(container.querySelector("[data-testid=quote-margin]")).toBeNull();
});

it.each([
  [0.2, "1 min"],
  [29.07, "29 min"],
  [120, "2 h"],
  [1500, "25 h"],
])("formats %f minutes as %s", (minutes, expected) => {
  render(<QuoteResult outcome="success" quote={{ ...QUOTE, timeMinutes: minutes }} filename="a.stl" />, container);

  expect(text("quote-time")).toBe(expected);
});

it("AC-ui-3: an error shows the mapped text and never the raw backend payload", () => {
  render(
    <QuoteResult
      outcome="error"
      failure={{ kind: "backend", code: "quote.exceeds_build_volume", message: "RAW-BACKEND-DETAIL" }}
      filename="a.stl"
    />,
    container,
  );

  expect(text("quote-result-message")).toContain("larger than our printer");
  expect(container.textContent).not.toContain("RAW-BACKEND-DETAIL");
  expect(container.textContent).not.toContain("quote.exceeds_build_volume");
  expect(container.querySelector("[data-testid=quote-price]")).toBeNull();
});

it("AC-ui-4: a lost connection renders connection wording, not a model failure", () => {
  render(<QuoteResult outcome="error" failure={{ kind: "connection_lost" }} filename="a.stl" />, container);

  expect(text("quote-result-message")).toContain("connection was lost");
});
