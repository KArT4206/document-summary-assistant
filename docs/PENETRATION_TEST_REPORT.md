# Penetration Test Report

**Scope**: this application's own local/production-build environment, running on `localhost`, at the commit this report was written against. No third-party infrastructure, no systems outside this codebase, were tested. All payloads used were harmless/synthetic (no destructive operations, no real credentials, no actual data exfiltration).

**Method**: manual and automated testing against the running app (dev server and a real `next build` + `next start` production server), combined with static code review. Where a finding is backed by an automated test, that test is cited and remains in the repository to prevent regression.

## Authentication

Not applicable — no authentication exists in this application by design (see [THREAT_MODEL.md](THREAT_MODEL.md)). No findings possible in this category.

## Authorization

Not applicable — no per-user resources exist to authorize access to. No findings possible in this category.

## Session management

Not applicable — no sessions/cookies are used by this application.

## Input validation

- File type: tested extension spoofing, MIME spoofing, and outright unsupported types (zip magic bytes). All correctly rejected server-side based on actual file signature, not client claims. **No finding.**
- File size: tested empty files, oversized files with honest `Content-Length`, and a chunked-encoding upload that omits `Content-Length` entirely. All correctly bounded. One real bug found and fixed during this engagement (see below).
- Summary length parameter: tested an invalid/unrecognized value — correctly rejected by Zod schema validation (400). **No finding.**

## Injection

- **XSS (reflected/stored/DOM)**: no `dangerouslySetInnerHTML` exists anywhere in the codebase (grep-verified); all rendered content (filenames, extracted text preview, AI summary content) goes through React's default text-interpolation, which auto-escapes. Filenames are additionally sanitized server-side before ever reaching the client. **No finding**, with the caveat that a live-rendered adversarial AI response was not exercised end-to-end (blocked on API key — see [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md) NOT TESTED).
- **HTML injection**: same mitigations as XSS above. **No finding.**
- **SQL/NoSQL injection**: not applicable — no database exists in this application.
- **Command injection**: no `child_process` or shell invocation exists anywhere in the codebase (grep-verified). **No finding.**
- **Path traversal**: filenames are sanitized and, more fundamentally, are never used to construct a filesystem path at all — uploaded files are never written to disk. **No finding.**
- **Header injection / CRLF injection**: attempted via a crafted `X-Forwarded-For` value; the runtime's `Headers` API itself rejects CRLF in header values at construction time, before the payload can reach any application code. **No finding** (defense exists at the platform layer, confirmed by test, not merely assumed).
- **Prompt injection**: 5 distinct adversarial payloads tested against the prompt-construction logic (not a live model — see below). All correctly kept out of the system role and confined to delimited `<document>` tags. **No finding at the application-wiring level.** The deeper question of whether a real model, given these payloads, would ever let injected text influence its summary prose is **not fully testable without a live API call** and is documented as a residual risk, not a resolved one.

## CSRF

Not deeply relevant in its classic form — there are no authenticated, cookie-based state-changing actions in this application (no login, no account settings, no delete/update operations tied to a session). The one state-changing-ish action (submitting a file for summarization) doesn't rely on any ambient authentication a forged cross-site request could ride on. **No finding**, with the note that this assessment would need to be revisited if accounts/sessions are added later.

## File upload

- Corrupted PDF, empty PDF, scanned/image-only PDF, blank image, oversized file: all tested and correctly handled with bounded resource use and clear errors (see [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md) SEC-006 through SEC-013).
- **Finding (resolved)**: a chunked-transfer-encoding upload that never declares `Content-Length` could bypass the header-based size pre-check. **Fix**: added a hard streaming byte-cap (`src/lib/request-limits.ts`) that counts actual bytes received regardless of what the client claims. Verified with a live raw HTTP request using manual chunked framing.
- **Finding (resolved, more significant)**: while testing the above, discovered that Next.js's own middleware/proxy layer has an undocumented-until-you-hit-it default 10MB body cap (`proxyClientMaxBodySize`) that silently truncated legitimate uploads in the 10-15MB range — well under this app's own advertised 15MB limit — causing a generic 500 error instead of the file being processed. **Fix**: raised `proxyClientMaxBodySize` to 20MB in `next.config.ts`. Verified with live 12MB/14MB/16MB requests against a rebuilt production server, and locked in with a permanent E2E regression test.

## Resource exhaustion

- OCR: page count, render dimension, per-page timeout, and total time budget are all capped (see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md)). Tested with a real scanned PDF processed successfully within these bounds.
- Upload size: capped and enforced at two independent layers (header check + streaming byte-count), plus the `next.config.ts` fix above.
- AI input size: capped before reaching the model (200,000 chars at extraction, 60,000 chars at the AI-provider layer).
- **No finding** beyond the two resolved items above.

## API abuse / rate limiting

Rate limiting tested and functioning as designed for a single-process deployment (10 requests/5min for uploads, 20/5min for AI calls, per-IP). **Finding, documented rather than silently accepted**: the limiter is in-memory and therefore ineffective across multiple serverless instances. This is a known, stated architectural trade-off (see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md)) appropriate for this assessment's scope, not a gap discovered and left unaddressed.

## Error disclosure

Every tested error path (validation failure, extraction failure, AI failure, unexpected internal error) returns a generic, safe, user-facing message. No stack trace, library error text, internal file path, or `node_modules` reference was found in any response body across all tested error conditions. **No finding.**

## Security headers

CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy all verified present on a live production build. The CSP was iterated on twice during this engagement to reach a genuinely strict, functioning policy (`script-src 'self' 'nonce-x' 'strict-dynamic'`, no `unsafe-inline`) — see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for the detailed history of what broke and why, and how it was fixed and verified. **No finding remaining.**

## Secrets

No secret found committed to source control at any point checked during this engagement. `.env*` gitignored; `.env.example` contains variable names only; the API key is read server-side only and never referenced from client code. **No finding.**

## Data leakage

No user data is persisted server-side. The only external data transmission is extracted document text to the Gemini API for summarization, which is explicitly documented for the user (see [PRIVACY_AND_DATA_HANDLING.md](PRIVACY_AND_DATA_HANDLING.md)). **No finding.**

## Business logic abuse

The length-selection parameter is schema-validated against a fixed enum (`short`/`medium`/`long`) — no path exists to request an out-of-bounds or malformed length. Regenerating a summary or switching lengths re-runs the full pipeline rather than trusting any client-supplied prior result. **No finding.**

## Summary

**No critical vulnerabilities were identified during the defined test scope.** Two real bugs were found and fixed during this engagement (chunked-encoding upload size bypass; Next.js's own 10MB proxy body-size default silently truncating legitimate uploads). One architectural trade-off is documented rather than resolved (in-memory rate limiting on non-serverless-safe storage). This statement is scoped to what was actually tested (see [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md) for the full test list and the NOT TESTED section) — it is not a claim of exhaustive security coverage, and it is not a claim that the application is invulnerable.
