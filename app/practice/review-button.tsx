"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/button";
import { finishSession } from "@/lib/sessionHandoff";

/* Opens the feedback chat. A session still running is ended first, so what
   was played so far is graded and stored before the chat reads it. */
export default function ReviewButton() {
  const router = useRouter();

  function handleClick() {
    finishSession();
    router.push("/feedback");
  }

  return (
    <button type="button" onClick={handleClick} className={buttonClass("primary")}>
      Review session
    </button>
  );
}
