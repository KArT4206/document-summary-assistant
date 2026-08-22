import { NextRequest, NextResponse } from "next/server";

/**
 * Security headers, applied per-request.
 *
 * CSP: uses a fresh per-request nonce with `strict-dynamic`, no `'unsafe-inline'`.
 * Getting this working took two attempts:
 *  1. First attempt only set the CSP on the *response* headers. Next.js's App
 *     Router reads the nonce for its own inline hydration scripts from the
 *     *request* header `content-security-policy` (see
 *     next/dist/server/app-render/get-script-nonce-from-header.js), not from
 *     the response — so the nonce was generated but never actually reached
 *     Next's renderer, and `strict-dynamic` blocked everything (verified
 *     against a production build).
 *  2. Fix: forward the same CSP (with nonce) on the outgoing *request*
 *     headers too, via NextResponse.next({ request: { headers } }), and force
 *     the root layout to render dynamically (`export const dynamic =
 *     "force-dynamic"`) so a fresh nonce is actually available per request —
 *     a statically prerendered page is built once and can never carry a
 *     per-request value.
 */
export function proxy(request: NextRequest) {
  void request;

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
  requestHeaders.set("Content-Security-Policy", csp);

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
