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

// Preact flushes hook state updates on a microtask, so DOM assertions after a
// state-changing event must wait a tick first (same pattern as UploadForm.test.tsx).
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("CustomerForm inline validation", () => {
  it("AC-1: shows no error messages before any field is touched", () => {
    renderForm();

    expect(container.querySelector("[data-testid=customer-name-error]")).toBeNull();
    expect(container.querySelector("[data-testid=customer-phone-error]")).toBeNull();
    expect(container.querySelector("[data-testid=customer-email-error]")).toBeNull();
    expect(container.querySelector("[data-testid=customer-quantity-error]")).toBeNull();
  });

  it("AC-2: shows 'Name is required' after blurring an empty Name field", async () => {
    renderForm();

    blur(field("customer-name"));
    await flush();

    expect(errorText("customer-name-error")).toBe("Name is required");
  });

  it("AC-3: shows 'Phone is required' after blurring an empty Phone field", async () => {
    renderForm();

    blur(field("customer-phone"));
    await flush();

    expect(errorText("customer-phone-error")).toBe("Phone is required");
  });

  it("AC-4: shows 'Enter a valid email' after blurring an invalid Email field", async () => {
    renderForm();

    setValue(field("customer-email"), "not-an-email");
    blur(field("customer-email"));
    await flush();

    expect(errorText("customer-email-error")).toBe("Enter a valid email");
  });

  it("AC-5: shows a quantity error after blurring Quantity set to 0", async () => {
    renderForm();

    setValue(field("customer-quantity"), "0");
    blur(field("customer-quantity"));
    await flush();

    expect(errorText("customer-quantity-error")).toBe(
      "Quantity must be a whole number greater than zero",
    );
  });

  it("AC-6: clears the error as soon as the touched field becomes valid", async () => {
    renderForm();

    const name = field("customer-name");
    blur(name);
    await flush();
    expect(errorText("customer-name-error")).toBe("Name is required");

    setValue(name, "Jane Doe");
    await flush();

    expect(container.querySelector("[data-testid=customer-name-error]")).toBeNull();
  });
});
