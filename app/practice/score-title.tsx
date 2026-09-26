"use client";

import { useSyncExternalStore } from "react";
import { SCORE_NAME_KEY } from "@/components/upload-form";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot() {
  try {
    return window.sessionStorage.getItem(SCORE_NAME_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

/* Reads the uploaded file name saved by the landing page. */
export default function ScoreTitle() {
  const name = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span className="truncate" title={name ?? undefined}>
      {name ?? "Untitled score"}
    </span>
  );
}
