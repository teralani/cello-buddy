"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/button";
import { SCORE_NAME_KEY } from "@/components/upload-form";
import { METRICS_KEY, sampleMetrics } from "@/lib/metrics";

/* Sends the recorded session to the feedback chat. Until the recorder exists,
   a sample metrics object is written if nothing has been recorded yet. */
export default function ReviewButton() {
  const router = useRouter();

  function handleClick() {
    try {
      if (!window.sessionStorage.getItem(METRICS_KEY)) {
        const piece = window.sessionStorage.getItem(SCORE_NAME_KEY) ?? sampleMetrics.piece;
        window.sessionStorage.setItem(
          METRICS_KEY,
          JSON.stringify({ ...sampleMetrics, piece, recordedAt: new Date().toISOString() }),
        );
      }
    } catch {
      /* Session storage may be unavailable. The feedback page handles missing data. */
    }
    router.push("/feedback");
  }

  return (
    <button type="button" onClick={handleClick} className={buttonClass("primary")}>
      Review session
    </button>
  );
}
