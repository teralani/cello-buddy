"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/button";

export default function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Try again.");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {error ? <span role="alert" className="text-sm text-danger">{error}</span> : null}
      <button type="button" onClick={handleClick} disabled={submitting} className={buttonClass("ghost")}>
        {submitting ? "Signing out…" : "Sign out"}
      </button>
    </>
  );
}
