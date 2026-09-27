"use client";

import Link from "next/link";
import { buttonClass } from "@/components/button";
import { useSessionEmail } from "@/lib/useSessionEmail";

/* Opens the account page. The circle shows the first letter of the signed-in
   email so the header hints at who is signed in. */
export default function ProfileButton() {
  const email = useSessionEmail();
  const initial = email?.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link href="/account" className={buttonClass("ghost", "gap-2 pl-1.5")} aria-label="Account">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background"
      >
        {initial}
      </span>
      Account
    </Link>
  );
}
