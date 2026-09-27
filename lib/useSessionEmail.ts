"use client";

import { useSyncExternalStore } from "react";
import { SESSION_EMAIL_KEY } from "@/lib/session";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(SESSION_EMAIL_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): null {
  return null;
}

/* The email the current session was started with, or null before hydration
   and when storage is unavailable. */
export function useSessionEmail(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
