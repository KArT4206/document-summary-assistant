import { NextRequest, NextResponse } from "next/server";

/**
 * Security headers, applied per-request via middleware rather than static
 * next.config.ts headers(), so the CSP can use a fresh nonce for Next.js's
 * own inline hydration scripts instead of a blanket 'unsafe-inline'
 * (which was tried first — 'script-src self' with no nonce silently broke
 * hydration in the production build; see tests/e2e/debug.spec.ts history).
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");

  return response;
}

export const config = {
  matcher: [
    // Skip static assets; apply to pages and API routes.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
