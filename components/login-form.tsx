"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonClass } from "@/components/button";

const inputClass =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:border-foreground focus-visible:outline-none";

/* Email and password access backed by the FastAPI auth endpoints. */
export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail || !password || (mode === "register" && !trimmedName)) {
      setError(
        mode === "register"
          ? "Enter your name, email, and password."
          : "Enter your email and password.",
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          ...(mode === "register" ? { name: trimmedName } : {}),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Authentication failed. Try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the sign-in service. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Account access"
        className="grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-1"
      >
        {(["login", "register"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            disabled={submitting}
            onClick={() => {
              setMode(option);
              setError(null);
            }}
            className={buttonClass(mode === option ? "primary" : "ghost", "w-full")}
          >
            {option === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {mode === "register" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            className={inputClass}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          placeholder="••••••••"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          className={inputClass}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className={buttonClass("primary", "mt-2 self-start")}
      >
        {submitting
          ? mode === "register"
            ? "Creating account…"
            : "Signing in…"
          : mode === "register"
            ? "Create account"
            : "Sign in"}
      </button>
    </form>
  );
}
