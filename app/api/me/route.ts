import { BackendUnavailable, callBackend, isRecord, notSignedInResponse, sessionUser } from "@/lib/server/backend";

export type CurrentUserResponse = { id: number; email: string; name: string | null };

/* Who is signed in: the id and email come from the session token, the name
   from the backend's user record when it can be reached. */
export async function GET(request: Request) {
  const user = await sessionUser();
  if (!user) return notSignedInResponse();

  let name: string | null = null;
  try {
    const result = await callBackend(request, `/user/get-user/${user.id}/`, { token: user.token });
    if (result.status === 401) return notSignedInResponse();
    if (result.ok && isRecord(result.payload) && typeof result.payload.name === "string") {
      name = result.payload.name.trim() || null;
    }
  } catch (error) {
    if (!(error instanceof BackendUnavailable)) throw error;
    /* The token still identifies the user; the greeting falls back to the email. */
  }
  const body: CurrentUserResponse = { id: user.id, email: user.email, name };
  return Response.json(body);
}
