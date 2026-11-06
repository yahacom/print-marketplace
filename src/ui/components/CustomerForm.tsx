import { useState } from "preact/hooks";
import type { CustomerInfo } from "../order-client.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CustomerFormProps {
  // Present while the confirm request is in flight: disables inputs and both buttons.
  disabled?: boolean;
  onSubmit: (customer: CustomerInfo) => void;
  // Back to start lives in this form's action row (beside Confirm order), not the
  // caller's layout, so the two buttons can sit in one row without prop-drilling a slot.
  onBackToStart: () => void;
}

// Name/Phone/Email required before Confirm order is enabled. Trimmed values are what
// get sent; the backend re-validates (never trust the client) and is the source of truth.
type Field = "name" | "phone" | "email" | "quantity";

export function CustomerForm({ disabled, onSubmit, onBackToStart }: CustomerFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    name: false,
    phone: false,
    email: false,
    quantity: false,
  });

  const quantityValue = Number(quantity);
  const nameValid = name.trim() !== "";
  const phoneValid = phone.trim() !== "";
  const emailValid = EMAIL_PATTERN.test(email.trim());
  const quantityValid = Number.isInteger(quantityValue) && quantityValue > 0;
  const valid = nameValid && phoneValid && emailValid && quantityValid;

  const touch = (field: Field) => () => setTouched((prev) => ({ ...prev, [field]: true }));

  const nameError = touched.name && !nameValid ? "Name is required" : null;
  const phoneError = touched.phone && !phoneValid ? "Phone is required" : null;
  const emailError = touched.email && !emailValid ? "Enter a valid email" : null;
  const quantityError =
    touched.quantity && !quantityValid
      ? "Quantity must be a whole number greater than zero"
      : null;

  return (
    <form
      data-testid="customer-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onSubmit({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            quantity: quantityValue,
          });
        }
      }}
    >
      <input
        type="text"
        aria-label="Name"
        placeholder="Name"
        data-testid="customer-name"
        value={name}
        disabled={disabled}
        onInput={(event) => setName(event.currentTarget.value)}
        onBlur={touch("name")}
      />
      {nameError && <p data-testid="customer-name-error">{nameError}</p>}
      <input
        type="tel"
        aria-label="Phone"
        placeholder="Phone"
        data-testid="customer-phone"
        value={phone}
        disabled={disabled}
        onInput={(event) => setPhone(event.currentTarget.value)}
        onBlur={touch("phone")}
      />
      {phoneError && <p data-testid="customer-phone-error">{phoneError}</p>}
      <input
        type="email"
        aria-label="Email"
        placeholder="Email"
        data-testid="customer-email"
        value={email}
        disabled={disabled}
        onInput={(event) => setEmail(event.currentTarget.value)}
        onBlur={touch("email")}
      />
      {emailError && <p data-testid="customer-email-error">{emailError}</p>}
      <input
        type="number"
        min="1"
        step="1"
        aria-label="Quantity"
        placeholder="Quantity"
        data-testid="customer-quantity"
        value={quantity}
        disabled={disabled}
        onInput={(event) => setQuantity(event.currentTarget.value)}
        onBlur={touch("quantity")}
      />
      {quantityError && <p data-testid="customer-quantity-error">{quantityError}</p>}
      <div class="form-actions">
        <button type="button" class="button" disabled={disabled} onClick={onBackToStart}>
          Back to start
        </button>
        <button
          type="submit"
          class="button button--confirm"
          data-testid="confirm-button"
          disabled={disabled || !valid}
        >
          Confirm order
        </button>
      </div>
    </form>
  );
}
