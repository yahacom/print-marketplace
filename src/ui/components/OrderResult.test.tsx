// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, expect, it } from "vitest";
import { OrderResult } from "./OrderResult.js";

const container = document.createElement("div");
document.body.appendChild(container);
afterEach(() => render(null, container));

const message = () => container.querySelector("[data-testid=order-result-message]")?.textContent;

it("shows the confirmed text with no buttons", () => {
  render(<OrderResult outcome="confirmed" filename="a.stl" />, container);

  expect(message()).toBe("Order confirmed");
  expect(container.querySelector("button")).toBeNull();
});

it("shows the declined text", () => {
  render(<OrderResult outcome="declined" filename="a.stl" />, container);

  expect(message()).toBe("No order was placed");
});

it("shows the mapped error text only, as an alert", () => {
  render(
    <OrderResult
      outcome="error"
      failure={{ kind: "backend", status: 409, code: "order.already_decided", message: "RAW-BACKEND-DETAIL" }}
      filename="a.stl"
    />,
    container,
  );

  expect(message()).toBe("This quote already has a final decision.");
  expect(container.textContent).not.toContain("RAW-BACKEND-DETAIL");
  expect(container.querySelector("[role=alert]")).not.toBeNull();
});

it("renders the filename as text, not markup", () => {
  render(<OrderResult outcome="confirmed" filename={'<img src=x onerror="alert(1)">.stl'} />, container);

  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("[data-testid=active-filename]")?.textContent).toContain("<img");
});
