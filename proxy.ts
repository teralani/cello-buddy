import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/* Keep app pages behind sign-in; auth handlers set and clear this token cookie. */
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;
  const onLoginPage = pathname === "/login";

  if (!signedIn && !onLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (signedIn && onLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  /* Skip API routes, Next internals, and any request for a file with an
     extension. Everything else is a page and gets the login check. */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
