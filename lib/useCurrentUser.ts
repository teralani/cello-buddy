"use client";

import { useEffect, useState } from "react";
import { fetchCurrentUser, type CurrentUser } from "@/lib/practiceApi";

/* One lookup per page load, shared by every component that asks. */
let pending: Promise<CurrentUser | null> | null = null;

function load(): Promise<CurrentUser | null> {
  pending ??= fetchCurrentUser().then((user) => {
    if (user === null) pending = null;
    return user;
  });
  return pending;
}

/* The signed-in user: `undefined` while loading, `null` when the session
   cannot be identified (signed out, or the token has expired). */
export function useCurrentUser(): CurrentUser | null | undefined {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    load().then((result) => {
      if (!cancelled) setUser(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

/* The first name from the user record, or the email's local part when it
   reads like a name. null when neither does. */
export function displayName(user: CurrentUser | null | undefined): string | null {
  const fromRecord = user?.name?.trim().split(/\s+/)[0];
  if (fromRecord) return fromRecord;
  const local = user?.email.split("@")[0]?.split(/[._\-+0-9]/)[0] ?? "";
  if (local.length < 2 || local.length > 14 || !/^[a-z]+$/i.test(local)) return null;
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}
