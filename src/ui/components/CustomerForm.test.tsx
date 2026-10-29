// @vitest-environment happy-dom
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerForm } from "./CustomerForm.js";

const container = document.createElement("div");
document.body.appendChild(container);

afterEach(() => render(null, container));

function renderForm() {
  render(
    <CustomerForm onSubmit={vi.fn()} onBackToStart={vi.fn()} />,
    container,
  );
}

function field(testId: string): HTMLInputElement {
  return container.querySelector(`[data-testid=${testId}]`) as HTMLInputElement;
}

function setValue(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function blur(input: HTMLInputElement) {
  input.dispatchEvent(new Event("blur", { bubbles: true }));
}

function errorText(testId: string): string | null | undefined {
  return container.querySelector(`[data-testid=${testId}]`)?.textContent;
}

describe("CustomerForm inline validation", () => {
  it("AC-1: shows no error messages before any field is touched", () => {
    renderForm();

    expect(container.querySelector("[data-testid=customer-name-error]")).toBeNull();
    expect(container.querySelector("[data-testid=customer-phone-error]")).toBeNull();
    expect(container.querySelector("[data-testid=customer-email-error]")).toBeNull();
    expect(container.querySelector("[data-testid=customer-quantity-error]")).toBeNull();
  });

  it("AC-2: shows 'Name is required' after blurring an empty Name field", () => {
    renderForm();

    blur(field("customer-name"));

    expect(errorText("customer-name-error")).toBe("Name is required");
  });

  it("AC-3: shows 'Phone is required' after blurring an empty Phone field", () => {
    renderForm();

    blur(field("customer-phone"));

    expect(errorText("customer-phone-error")).toBe("Phone is required");
  });

  it("AC-4: shows 'Enter a valid email' after blurring an invalid Email field", () => {
    renderForm();

    setValue(field("customer-email"), "not-an-email");
    blur(field("customer-email"));

    expect(errorText("customer-email-error")).toBe("Enter a valid email");
  });

  it("AC-5: shows a quantity error after blurring Quantity set to 0", () => {
    renderForm();

    setValue(field("customer-quantity"), "0");
    blur(field("customer-quantity"));

    expect(errorText("customer-quantity-error")).toBe(
      "Quantity must be a whole number greater than zero",
    );
  });

  it("AC-6: clears the error as soon as the touched field becomes valid", () => {
    renderForm();

    const name = field("customer-name");
    blur(name);
    expect(errorText("customer-name-error")).toBe("Name is required");

    setValue(name, "Jane Doe");

    expect(container.querySelector("[data-testid=customer-name-error]")).toBeNull();
  });
});
