import type { CurrentUserResponse } from "@/app/api/me/route";
import type { LeaderboardEntry } from "@/app/api/practice/leaderboard/route";
import type { ApiSession } from "@/app/api/practice/sessions/route";
import type { PracticeMetrics } from "@/lib/metrics";

export type { ApiSession, CurrentUserResponse as CurrentUser, LeaderboardEntry };

/* Browser-side calls to this app's own API routes, which in turn talk to the
   FastAPI backend. Every reader resolves to null when the call fails for any
   reason, so callers can fall back without inspecting errors. */

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchCurrentUser(): Promise<CurrentUserResponse | null> {
  return getJson<CurrentUserResponse>("/api/me");
}

/* The signed-in user's stored sessions, newest first. */
export async function fetchSessions(): Promise<ApiSession[] | null> {
  const body = await getJson<{ sessions?: unknown }>("/api/practice/sessions");
  return body && Array.isArray(body.sessions) ? (body.sessions as ApiSession[]) : null;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[] | null> {
  const body = await getJson<{ entries?: unknown }>("/api/practice/leaderboard");
  return body && Array.isArray(body.entries) ? (body.entries as LeaderboardEntry[]) : null;
}

/* Stores a finished play-through. `keepalive` lets the request finish even
   when the student moves straight on to the review page. */
export async function recordSession(metrics: PracticeMetrics): Promise<boolean> {
  try {
    const response = await fetch("/api/practice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
