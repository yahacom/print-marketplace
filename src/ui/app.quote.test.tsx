// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";
import { App, transitions } from "./app.js";

const container = document.createElement("div");
document.body.appendChild(container);
afterEach(() => render(null, container));

const QUOTE = {
  price: 5.7,
  timeMinutes: 90,
  filamentGrams: 50,
  breakdown: { timeCost: 3.75, materialCost: 1, margin: 0.95 },
};

describe("App quote states", () => {
  it("transitions build the quote states", () => {
    expect(transitions.quoteReady(QUOTE, "a.stl")).toEqual({
      status: "quote_ready",
      quote: QUOTE,
      filename: "a.stl",
    });
    expect(transitions.quoteFail({ kind: "connection_lost" }, "a.stl")).toEqual({
      status: "quote_error",
      failure: { kind: "connection_lost" },
      filename: "a.stl",
    });
  });

  it("quote_ready renders the quote and a Back to start button that returns to the form", async () => {
    render(<App initialState={transitions.quoteReady(QUOTE, "a.stl")} />, container);

    expect(container.querySelector("[data-testid=quote-price]")?.textContent).toBe("$5.70");
    expect(container.querySelector("[data-testid=active-filename]")?.textContent).toBe("a.stl");
    expect(container.querySelector("[data-testid=upload-form]")).toBeNull();

    (container.querySelector("button") as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.querySelector("[data-testid=upload-form]")).not.toBeNull();
    expect(container.querySelector("[data-testid=quote-result]")).toBeNull();
  });

  it("quote_error renders the mapped message only", () => {
    render(
      <App
        initialState={transitions.quoteFail(
          {
            kind: "backend",
            code: "quote.unslicable",
            message: "RAW-BACKEND-DETAIL",
          },
          "a.stl",
        )}
      />,
      container,
    );

    expect(container.querySelector("[data-testid=quote-result-message]")?.textContent).toContain(
      "can't quote it",
    );
    expect(container.textContent).not.toContain("RAW-BACKEND-DETAIL");
  });
});
