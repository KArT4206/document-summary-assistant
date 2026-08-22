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
│       — AIProvider interface → GeminiProvider (Structured Outputs)│
│       — Zod-validated response schema                            │
│  7. structured JSON response                                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                        Gemini API (external)
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
- `src/lib/ai/` — `types.ts` defines the `AIProvider` interface and Zod schemas; `gemini-provider.ts` is the active Gemini implementation (free tier, `gemini-3.6-flash` by default); `openai-provider.ts` is a second, fully-working implementation of the same interface (not active — demonstrates the abstraction is real, not vendor-locked); `index.ts` is the single place that decides which provider is active.
- `src/lib/rate-limit.ts` — in-memory, per-IP sliding-window rate limiter (see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for its deployment trade-offs).
- `src/lib/request-limits.ts` — hard streaming byte-cap on the request body, independent of the client-supplied `Content-Length` header.
- `src/lib/errors.ts` — `AppError` + `toClientError()`: the single chokepoint that guarantees no internal error detail (stack traces, library error messages) ever reaches the client.
- `src/proxy.ts` — Next.js 16's middleware convention. Applies security headers and the CSP nonce to every request.

## Storage

None. There is no database and no persistent file storage. Uploaded file bytes are read into memory (`Buffer`), processed, and discarded when the request completes. See [PRIVACY_AND_DATA_HANDLING.md](PRIVACY_AND_DATA_HANDLING.md).

## External dependencies

- **Google Gemini API** — the only external network call the server makes with user-derived data (extracted document text), using the free tier. Model selection was verified directly against the live API, not just static docs — see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for that story and the prompt-injection defense around this call.

## Deployment

Designed for a Node.js host that supports Next.js 16 (Vercel or equivalent). See [README.md](../README.md) for setup and environment variables, and [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for the rate-limiter's single-instance assumption, which matters for the choice of hosting/scaling model.
