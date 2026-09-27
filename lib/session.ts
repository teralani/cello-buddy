/* Client-side session stub. There is no backend yet: "logging in" just sets
   a cookie that the proxy checks, and signing out clears it. Swap these for
   real auth calls later without touching the UI. */

export const SESSION_COOKIE = "cello-buddy-session";
export const SESSION_EMAIL_KEY = "cello-buddy:session-email";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export function startSession(email: string) {
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${ONE_WEEK_SECONDS}; samesite=lax`;
  try {
    window.localStorage.setItem(SESSION_EMAIL_KEY, email);
  } catch {
    /* Storage may be unavailable; the cookie alone is enough to get in. */
  }
}

/* Password change stub. There is nothing to check the current password
   against yet, so this only mimics a round trip; replace the body with the
   real auth call and throw an Error with a user-facing message on failure. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  void currentPassword;
  void newPassword;
  await new Promise((resolve) => setTimeout(resolve, 400));
}

export function endSession() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    window.localStorage.removeItem(SESSION_EMAIL_KEY);
  } catch {
    /* Ignore. */
  }
}
