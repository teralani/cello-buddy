import { cookies } from "next/headers";
import {
  BackendUnavailable,
  backendErrorMessage,
  callBackend,
  isRecord,
  unavailableResponse,
} from "@/lib/server/backend";
import { SESSION_COOKIE } from "@/lib/session";

const SESSION_TTL_SECONDS = 20 * 60;

type RequestBody = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
};

/* Sign in, register, or sign out against the FastAPI backend. A successful
   sign-in or registration stores the backend's access token in the session
   cookie; see lib/server/backend.ts for how the backend is reached. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (action === "logout") {
    (await cookies()).delete(SESSION_COOKIE);
    return Response.json({ ok: true });
  }
  if (action !== "login" && action !== "register") {
    return Response.json({ error: "Unknown authentication action." }, { status: 404 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!email || !password || (action === "register" && !name)) {
    return Response.json(
      { error: action === "register" ? "Enter your name, email, and password." : "Enter your email and password." },
      { status: 400 },
    );
  }

  let result;
  try {
    result =
      action === "register"
        ? await callBackend(request, "/auth/", {
            method: "POST",
            body: { name, email, high_score: 0, password_hash: password },
          })
        : await callBackend(request, "/auth/token", {
            method: "POST",
            body: new URLSearchParams({ username: email, password }),
          });
  } catch (error) {
    if (error instanceof BackendUnavailable) return unavailableResponse();
    throw error;
  }

  if (!result.ok) {
    const fallback = action === "register" ? "Could not create your account." : "Email or password is incorrect.";
    return Response.json({ error: backendErrorMessage(result.payload, fallback) }, { status: result.status });
  }

  const accessToken = isRecord(result.payload) ? result.payload.access_token : null;
  if (typeof accessToken !== "string" || !accessToken) {
    return Response.json({ error: "The backend returned an invalid session." }, { status: 502 });
  }

  (await cookies()).set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return Response.json({ ok: true });
}
