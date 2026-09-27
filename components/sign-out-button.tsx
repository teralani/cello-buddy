"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/button";
import { endSession } from "@/lib/session";

export default function SignOutButton() {
  const router = useRouter();

  function handleClick() {
    endSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick} className={buttonClass("ghost")}>
      Sign out
    </button>
  );
}
