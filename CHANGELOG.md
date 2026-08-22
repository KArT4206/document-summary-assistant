# Changelog

## Unreleased

### Added — UI redesign
- Real design token system (`src/app/globals.css`): semantic colors (background/surface/border/primary/text/success/warning/danger/info), radius scale, shadow scale, theme-aware for light and dark. Registered as first-class Tailwind utilities via `@theme inline`.
- Shared icon set (`src/components/icons.tsx`, 13 icons, one consistent visual language) replacing ad-hoc inline SVGs.
- Accessible toast/notification system (`src/components/Toast.tsx`, `aria-live` region) for copy/action feedback, replacing a single component-local "Copied!" text swap.
- Redesigned `UploadZone`, `ProcessingState` (real stage-list matching the actual server pipeline order, no fake percentages), `SummaryView` (dominant summary card, numbered key points, visually distinct improvement-suggestions card, per-section and full-summary copy actions), app shell with header/hero/footer, and error state with a contextual explanation (only shows "retry may help" copy for genuinely retryable error codes).
- Live-verified with real Gemini-generated content via Playwright screenshots at 320/390/768/1440/1920px: idle, processing, results (short/medium/long content), expanded source text, validation error, 404.

### Added
- Core application: PDF/image upload, drag-and-drop, PDF text extraction, scanned-PDF OCR (rasterize + tesseract.js), image OCR, AI-backed summarization (short/medium/long) behind a swappable `AIProvider` interface, key points, main ideas, improvement suggestions.
- Full async UI state machine (idle/processing/complete/error), custom 404 and global error pages, responsive layout.
- Server-side file validation by magic bytes, per-IP rate limiting, streaming request-body size cap, security headers with a strict nonce-based CSP.
- Prompt-injection defenses: explicit system/document role separation, `<document>` delimiting, Structured Outputs schema validation.
- Automated test suite: Vitest unit/integration tests (validation, extraction/OCR, AI provider error mapping — both Gemini and OpenAI implementations, prompt injection, API route) and Playwright E2E tests (upload journeys, validation errors, responsive layout, 404).
- Documentation suite: architecture, data flow, threat model, security architecture, security test report, penetration test report, OWASP verification matrix, test cases, UI QA report, error catalog, privacy/data handling, approach write-up.

### Changed
- **Switched the active AI provider from OpenAI to Google Gemini** (free tier, `gemini-3.6-flash`), to keep the project at zero API cost. The OpenAI implementation (`src/lib/ai/openai-provider.ts`) remains in the codebase, fully functional and tested, as a second implementation of the same `AIProvider` interface — proving the abstraction is real, not just a single hardcoded class. Switching back (or to another provider) means changing one line in `src/lib/ai/index.ts`.
- Narrowed `.gitignore`'s `.env*` pattern to `.env`, `.env.local`, `.env.*.local` — the previous blanket pattern was also hiding `.env.example` (the checked-in template) from git, which contributed to a real incident (see Fixed, below).

### Fixed
- **CSP breaking hydration**: an initial strict CSP (`script-src 'self' 'nonce' 'strict-dynamic'`) silently broke React hydration in the production build, because the nonce was only set on the response, not the request Next.js's App Router actually reads it from. Fixed by forwarding the CSP on the request headers too and forcing dynamic rendering so a per-request nonce is available at all.
- **Silent upload truncation on 10-15MB files**: discovered during security review that Next.js's own middleware/proxy layer has a default 10MB body-size cap (`proxyClientMaxBodySize`), silently truncating legitimate uploads under this app's advertised 15MB limit and surfacing as a generic 500 error. Fixed by raising the config value in `next.config.ts`; locked in with a permanent E2E regression test.
- **Corrupted-PDF handling gap**: an early refactor for scanned-PDF OCR support left `parser.getInfo()` outside the try/catch that wrapped `parser.getText()`, so a genuinely malformed PDF threw an uncaught `InvalidPDFException` instead of the intended `EXTRACTION_FAILED` error. Caught by an automated test, fixed immediately.
- **Gemini timeout error not mapped correctly**: the Gemini SDK throws a generic `AbortError` on client-side timeout, not an SDK-specific error with "timeout" in its message — the initial error mapping missed this and fell through to a generic `AI_PROVIDER_ERROR`. Discovered and fixed during live verification (forced a 1ms timeout against the real API, observed the actual error shape, fixed the mapping, reverted the test value).
- **Deprecated model reference**: the initially-configured `gemini-2.5-flash` turned out to already be unavailable to new projects — caught via a real 404 from the live API during verification (not from documentation, which was out of date), switched to `gemini-3.6-flash`.
- **Secret handling incident (caught before any exposure)**: a real API key was briefly pasted into `.env.example` (the checked-in template) instead of `.env.local`. Caught before any `git add`/commit; confirmed via `git log --all -p` that it never entered git history; moved to `.env.local`, `.env.example` restored to variable-names-only, and the `.gitignore` pattern that had been silently hiding `.env.example` from routine `git status` checks was narrowed (see Changed, above) so this class of mistake is easier to catch next time.

### Known limitations
- Rate limiting is in-memory and single-process; not effective across multiple serverless instances (documented, not silently accepted — see `docs/SECURITY_ARCHITECTURE.md`).
- Gemini free tier is low-volume (10 RPM / 250 RPD) — fine for this assessment, not for real production traffic without upgrading.
- The real Gemini happy path, including timeout/missing-key/invalid-key/provider-error and prompt-injection resistance, has been live-verified end-to-end (see `docs/SECURITY_TEST_REPORT.md`). Exhaustive coverage of every possible injection technique and a live-observed Gemini-specific 429 (as opposed to the app's own rate limiter) remain mocked-only, due to free-tier quota constraints on live testing.
