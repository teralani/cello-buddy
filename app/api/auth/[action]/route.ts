import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

const SESSION_TTL_SECONDS = 20 * 60;
const API_BASE_URL = (process.env.API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

type RequestBody = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String(item.msg)
          : "",
      )
      .filter(Boolean);
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
}

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

  let backendResponse: Response;
  try {
    if (action === "register") {
      backendResponse = await fetch(`${API_BASE_URL}/auth/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, high_score: 0, password_hash: password }),
        cache: "no-store",
      });
    } else {
      const credentials = new URLSearchParams({ username: email, password });
      backendResponse = await fetch(`${API_BASE_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: credentials,
        cache: "no-store",
      });
    }
  } catch {
    return Response.json(
      { error: "The backend API is unavailable. Start it and try again." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await backendResponse.json();
  } catch {
    payload = null;
  }
  if (!backendResponse.ok) {
    const fallback = action === "register" ? "Could not create your account." : "Email or password is incorrect.";
    return Response.json(
      { error: getErrorMessage(payload, fallback) },
      { status: backendResponse.status },
    );
  }

  const accessToken =
    typeof payload === "object" && payload !== null && "access_token" in payload
      ? payload.access_token
      : null;
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