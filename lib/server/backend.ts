import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

/* Server-only helpers for talking to the FastAPI backend in api/. */

export const BACKEND_UNAVAILABLE = "The backend API is unavailable. Start it and try again.";

export class BackendUnavailable extends Error {}

/* The full URL for a backend path. API_BASE_URL points at a separately hosted
   backend. Without it, development talks to a local uvicorn, and production
   calls the Python function Vercel builds from api/main.py at /api/main,
   passing the route in the `path` query parameter (see StripPathPrefix in
   api/main.py). Routing by query rather than by URL path keeps the trailing
   slashes some FastAPI routes require, which Next would otherwise strip. */
export function backendUrl(request: Request, path: string): string {
  const configured = process.env.API_BASE_URL?.trim();
  if (configured) return `${configured.replace(/\/$/, "")}${path}`;
  if (process.env.NODE_ENV === "development") return `http://127.0.0.1:8000${path}`;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  const proto = forwardedProto || (isLocal ? "http" : "https");
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("path", pathname.replace(/^\//, ""));
  return `${proto}://${host}/api/main?${params.toString()}`;
}

type BackendInit = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /* Sent as JSON, or as a form body when it is URLSearchParams. */
  body?: unknown;
  /* The session token, for backend routes that require a signed-in user. */
  token?: string;
};

export type BackendResult = { ok: boolean; status: number; payload: unknown };

/* Calls the backend and returns its JSON reply. FastAPI always answers in
   JSON, even for errors, so anything else means the request never reached
   it: a 404 page from Next, a crashed function, or a deployment protection
   screen. Those, and network failures, throw BackendUnavailable. */
export async function callBackend(request: Request, path: string, init: BackendInit = {}): Promise<BackendResult> {
  const url = backendUrl(request, path);
  const headers: Record<string, string> = {};
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && !process.env.API_BASE_URL?.trim()) headers["x-vercel-protection-bypass"] = bypass;
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  let body: string | URLSearchParams | undefined;
  if (init.body instanceof URLSearchParams) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = init.body;
  } else if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  let response: Response;
  try {
    response = await fetch(url, { method: init.method ?? "GET", headers, body, cache: "no-store" });
  } catch (error) {
    console.error(`backend: could not reach ${url}`, error);
    throw new BackendUnavailable(BACKEND_UNAVAILABLE);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    console.error(`backend: ${url} answered ${response.status} with ${contentType || "no content type"}`);
    throw new BackendUnavailable(BACKEND_UNAVAILABLE);
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { ok: response.ok, status: response.status, payload };
}

export function unavailableResponse(): Response {
  return Response.json({ error: BACKEND_UNAVAILABLE }, { status: 503 });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/* FastAPI's error shape: `detail` is a string, or a list of validation errors. */
export function backendErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (isRecord(item) && "msg" in item ? String(item.msg) : ""))
      .filter(Boolean);
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
}

export type SessionUser = { id: number; email: string; token: string };

/* The signed-in user, read from the session cookie's JWT payload. The token
   is decoded, not verified: the backend verifies it on every call that needs
   a user, and the proxy only lets signed-in browsers this far anyway. */
export async function sessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload: unknown = JSON.parse(json);
    if (!isRecord(payload)) return null;
    const id = typeof payload.id === "number" ? payload.id : Number(payload.id);
    const email = typeof payload.sub === "string" ? payload.sub : "";
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (!Number.isInteger(id) || !email || exp * 1000 <= Date.now()) return null;
    return { id, email, token };
  } catch {
    return null;
  }
}

export function notSignedInResponse(): Response {
  return Response.json({ error: "Not signed in." }, { status: 401 });
}
