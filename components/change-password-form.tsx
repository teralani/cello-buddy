"use client";

import { useState, type FormEvent } from "react";
import { buttonClass } from "@/components/button";
import { changePassword } from "@/lib/session";

const inputClass =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:border-foreground focus-visible:outline-none";

const MIN_LENGTH = 8;

type Field = { id: "current" | "next" | "confirm"; label: string; autoComplete: string };

const FIELDS: Field[] = [
  { id: "current", label: "Current password", autoComplete: "current-password" },
  { id: "next", label: "New password", autoComplete: "new-password" },
  { id: "confirm", label: "Confirm new password", autoComplete: "new-password" },
];

/* Validates locally, then hands off to lib/session's changePassword, which is
   a stub until there is a backend to check the current password against. */
export default function ChangePasswordForm() {
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  function update(id: Field["id"], value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setError(null);
    if (status === "saved") setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.current || !values.next || !values.confirm) {
      setError("Fill in all three fields.");
      return;
    }
    if (values.next.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters for the new password.`);
      return;
    }
    if (values.next === values.current) {
      setError("The new password matches the current one.");
      return;
    }
    if (values.next !== values.confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setStatus("saving");
    try {
      await changePassword(values.current, values.next);
      setValues({ current: "", next: "", confirm: "" });
      setStatus("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the password.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {FIELDS.map((field) => (
        <div key={field.id} className="flex flex-col gap-1.5">
          <label htmlFor={`password-${field.id}`} className="text-sm font-medium">
            {field.label}
          </label>
          <input
            id={`password-${field.id}`}
            name={field.id}
            type="password"
            autoComplete={field.autoComplete}
            value={values[field.id]}
            onChange={(event) => update(field.id, event.target.value)}
            className={inputClass}
          />
        </div>
      ))}

      <p className="text-xs text-muted">At least {MIN_LENGTH} characters.</p>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status === "saved" ? (
        <p role="status" className="text-sm">
          Password changed.
        </p>
      ) : null}

      <button type="submit" disabled={status === "saving"} className={buttonClass("primary", "self-start")}>
        {status === "saving" ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
