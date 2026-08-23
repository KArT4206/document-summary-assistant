# Architecture

## System overview

Document Summary Assistant is a single Next.js 16 (App Router, TypeScript) application. There is no separate backend service and no database — the entire system is one deployable unit: a static/dynamic frontend, one API route, and server-only library code, all in the same Next.js process.

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (client)                        │
│  UploadZone / ProcessingState / SummaryView (src/app/page.tsx)   │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ multipart/form-data (file, length)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/proxy.ts  — runs on every request                           │
│  • generates a per-request CSP nonce, sets it on request+response│
│  • sets security headers (HSTS, X-Frame-Options, etc.)           │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/summarize  (src/app/api/summarize/route.ts, Node)     │
│                                                                   │
│  1. rate limit check         (src/lib/rate-limit.ts)             │
│  2. request body size cap    (src/lib/request-limits.ts)         │
│  3. file validation          (src/lib/validation.ts)             │
│       — size, magic-byte MIME sniff, filename sanitization       │
│  4. text extraction          (src/lib/extraction/extract.ts)     │
│       — pdf-parse for text PDFs                                  │
│       — @napi-rs/canvas + pdfjs-dist raster + tesseract.js OCR   │
│         for scanned PDFs and images                              │
│  5. rate limit check (AI-specific, separate bucket)               │
│  6. AI summarization          (src/lib/ai/*)                     │
│       — AIProvider interface → AIRouter (Structured Outputs)      │
│       — Zod-validated response schema                            │
│  7. structured JSON response                                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                  AIRouter (src/lib/ai/router.ts)
                       │
                       ├── GeminiProvider ──▶ Gemini API (external, primary)
                       │
                       └── OllamaProvider ──▶ Ollama (private, fallback only —
                                               see "AI Router" below)
```

## Frontend

- `src/app/page.tsx` — the entire application UI lives on one route. An explicit client-side state machine (`AppState` in `src/lib/client-types.ts`) drives `idle → processing → complete | error`.
- `src/components/UploadZone.tsx` — drag/drop + file-picker upload, client-side pre-validation (extension, size) for fast feedback before any network call.
- `src/components/ProcessingState.tsx` — qualitative status labels during the request; no fabricated progress percentage, since the server does one request/response cycle with no granular progress channel.
- `src/components/SummaryView.tsx` — renders summary/key points/main ideas/suggestions, length selector, copy-to-clipboard, source text toggle.
- `src/app/not-found.tsx`, `src/app/error.tsx` — custom 404 and global error boundary.

## Backend

- `src/app/api/summarize/route.ts` — the only API route. Runs on the Node.js runtime (not Edge) because `pdf-parse`, `tesseract.js`, and `@napi-rs/canvas` need Node APIs and native bindings.
- `src/lib/validation.ts` — server-side file validation. Never trusts client-supplied MIME type or filename extension; reads actual file signature bytes via the `file-type` package.
- `src/lib/extraction/extract.ts` — the extraction/OCR pipeline (see [DATA_FLOW.md](DATA_FLOW.md) for the decision tree).
- `src/lib/ai/` — `types.ts` defines the `AIProvider` interface and Zod schemas; `gemini-provider.ts` is the primary Gemini implementation (free tier, `gemini-3.6-flash` by default); `ollama-provider.ts` is a fallback implementation calling a local/private Ollama server (`gemma4:e4b` by default); `router.ts` (`AIRouter`) implements `AIProvider` by trying Gemini first and falling back to Ollama only on quota/rate-limit or a transient outage — see [ARCHITECTURE.md's AI Router section below](#ai-router) and [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for the full decision tree; `openai-provider.ts` is a third, fully-working implementation of the same interface (not active — demonstrates the abstraction is real, not vendor-locked); `index.ts` is the single place that decides which provider is active (`AIRouter`).
- `src/lib/rate-limit.ts` — in-memory, per-IP sliding-window rate limiter (see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for its deployment trade-offs).
- `src/lib/request-limits.ts` — hard streaming byte-cap on the request body, independent of the client-supplied `Content-Length` header.
- `src/lib/errors.ts` — `AppError` + `toClientError()`: the single chokepoint that guarantees no internal error detail (stack traces, library error messages) ever reaches the client.
- `src/proxy.ts` — Next.js 16's middleware convention. Applies security headers and the CSP nonce to every request.

## AI Router

`src/lib/ai/router.ts` (`AIRouter`) is the active `AIProvider`. Decision tree:

| Gemini result | Router behavior |
|---|---|
| Success | Return the result. Ollama is never touched. |
| `AI_RATE_LIMITED` (quota/rate exhaustion) | If `OLLAMA_FALLBACK_ENABLED=true`, fall back to Ollama immediately (no retry — retrying an exhausted quota is pointless). Otherwise, surface `AI_UNAVAILABLE` directly. |
| `AI_TIMEOUT` / `AI_PROVIDER_ERROR` (transient outage) | Retry Gemini once; if that also fails, fall back to Ollama when `OLLAMA_FALLBACK_ENABLED=true`, otherwise surface `AI_UNAVAILABLE`. |
| `AI_CONFIG_ERROR` (missing/invalid API key) | **Never falls back**, regardless of the flag. Surfaced directly — a fallback here would silently hide a permanently broken deployment. |
| `AI_INVALID_RESPONSE` (our schema rejects the model's output) | **Never falls back**, regardless of the flag. This is a data-quality problem with the response, not a service outage. |

**`OLLAMA_FALLBACK_ENABLED` gates all Ollama access, and defaults to disabled.** `isFallbackEnabled()` (`src/lib/ai/ollama-provider.ts`) is checked before any Ollama-eligible failure is acted on, and the check happens *before* the router even calls `isOllamaAvailable()` — when the flag is off, zero network calls of any kind are made toward `OLLAMA_BASE_URL`. This is deliberate: `127.0.0.1` (the default `OLLAMA_BASE_URL`) has no meaning inside a deployed environment, so "assume Ollama is reachable" is never a safe default. Enabling fallback is always an explicit, environment-driven opt-in — never inferred from `NODE_ENV` or any other signal.

When the flag is enabled, the router checks `isOllamaAvailable()` (a fast `GET /api/tags` with a 2s timeout) before attempting generation. If Ollama is unreachable, or reachable but its own generation also fails, the router returns a single friendly `AI_UNAVAILABLE` error — it never reveals which provider failed, the Ollama URL, or any stack trace. The UI renders the exact same shape (`summary`/`keyPoints`/`mainIdeas`/`improvementSuggestions`) regardless of which provider actually generated it, or whether fallback was attempted at all.

Ollama is called only from the Next.js server process — the browser never has any path to it. See [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for the private-network requirement in production and the fallback flag as a security control.

## Storage

None. There is no database and no persistent file storage. Uploaded file bytes are read into memory (`Buffer`), processed, and discarded when the request completes. See [PRIVACY_AND_DATA_HANDLING.md](PRIVACY_AND_DATA_HANDLING.md).

## External dependencies

- **Google Gemini API** — the primary, external network call the server makes with user-derived data (extracted document text), using the free tier. Model selection was verified directly against the live API, not just static docs — see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for that story and the prompt-injection defense around this call.
- **Ollama (local/private, fallback only, opt-in)** — not "external" in the internet sense; a server the Next.js backend calls over a private network path (`127.0.0.1:11434` in local development). Only invoked when `OLLAMA_FALLBACK_ENABLED=true` **and** Gemini genuinely indicates quota/rate exhaustion or a transient outage. Never invoked, and never even probed for availability, when the flag is unset or any value other than `true`.

## Deployment

Designed for a Node.js host that supports Next.js 16 (Vercel or equivalent). See [README.md](../README.md) for setup and environment variables, and [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for the rate-limiter's single-instance assumption, which matters for the choice of hosting/scaling model.

**Ollama fallback in production**: `OLLAMA_FALLBACK_ENABLED` defaults to disabled and must be explicitly set to `true` for this deployment to ever attempt an Ollama call. Localhost Ollama is a local-development convenience, never a production deployment capability, and this project does not describe it as one. Turning the flag on in production only makes sense if a real, privately-reachable Ollama server exists for the deployed backend to call — this must never be a developer's own machine, and `127.0.0.1` has no meaning inside a deployed serverless function (it would just mean "this function invocation," not any developer's laptop). With the flag left at its default (disabled), the router never contacts any Ollama address at all — not even the `isOllamaAvailable()` check — and Gemini quota exhaustion surfaces the honest `AI_UNAVAILABLE` message directly. If a future deployment operates a real private Ollama server, fallback is enabled purely through environment variables (`OLLAMA_FALLBACK_ENABLED=true`, `OLLAMA_BASE_URL` pointed at that server) — no application code changes required.
