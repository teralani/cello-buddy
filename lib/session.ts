/* The cookie the auth routes set (app/api/auth) and the proxy checks. Its
   value is the backend's access token, and it is httpOnly, so the browser
   learns who is signed in through /api/me (lib/useCurrentUser.ts). */
export const SESSION_COOKIE = "cello-buddy-session";

/* Password change stub. There is nothing to check the current password
   against yet, so this only mimics a round trip; replace the body with the
   real auth call and throw an Error with a user-facing message on failure. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  void currentPassword;
  void newPassword;
  await new Promise((resolve) => setTimeout(resolve, 400));
}
