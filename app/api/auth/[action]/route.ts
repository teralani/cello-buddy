import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

const SESSION_TTL_SECONDS = 20 * 60;
const BACKEND_UNAVAILABLE = "The backend API is unavailable. Start it and try again.";

type RequestBody = {
  email?: unknown;
  name?: unknown;
  password?: unknown;
};

/* Where the FastAPI backend lives. API_BASE_URL points at a separately hosted
   backend. Without it the backend is reached through this app's own origin at
   /api/py, which next.config.ts rewrites to a local uvicorn in development and
   to the Python function built from api/main.py on Vercel. */
function backendBaseUrl(request: Request): string {
  const configured = process.env.API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  const proto = forwardedProto || (isLocal ? "http" : "https");
  return `${proto}://${host}/api/py`;
}

/* Headers for the backend call. When the backend is this same deployment and
   Vercel's deployment protection is on (preview URLs, for example), the bypass
   secret lets the server-to-server call through. */
function backendHeaders(contentType: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": contentType };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && !process.env.API_BASE_URL?.trim()) {
    headers["x-vercel-protection-bypass"] = bypass;
  }
  return headers;
}

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

  const baseUrl = backendBaseUrl(request);
  let backendResponse: Response;
  try {
    if (action === "register") {
      backendResponse = await fetch(`${baseUrl}/auth`, {
        method: "POST",
        headers: backendHeaders("application/json"),
        body: JSON.stringify({ name, email, high_score: 0, password_hash: password }),
        cache: "no-store",
      });
    } else {
      const credentials = new URLSearchParams({ username: email, password });
      backendResponse = await fetch(`${baseUrl}/auth/token`, {
        method: "POST",
        headers: backendHeaders("application/x-www-form-urlencoded"),
        body: credentials,
        cache: "no-store",
      });
    }
  } catch (error) {
    console.error(`auth/${action}: could not reach the backend at ${baseUrl}`, error);
    return Response.json({ error: BACKEND_UNAVAILABLE }, { status: 503 });
  }

  /* FastAPI always answers in JSON, even for errors. Anything else means the
     request never reached it: a 404 page from Next, a crashed function, or a
     deployment protection screen. */
  const contentType = backendResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    console.error(
      `auth/${action}: backend at ${baseUrl} answered ${backendResponse.status} with ${contentType || "no content type"}`,
    );
    return Response.json({ error: BACKEND_UNAVAILABLE }, { status: 503 });
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
