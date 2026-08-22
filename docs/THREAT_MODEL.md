# Threat Model

Scope: the Document Summary Assistant application (upload → extraction/OCR → AI summarization → response), as implemented at the time of writing. This is not a certification — it documents what was considered and what was done about it, for a reviewer to evaluate.

## Assets

- **Uploaded document content** — potentially sensitive to the user (the only "sensitive data" this app handles).
- **Gemini API key** — server-side secret; compromise would let an attacker run up API costs or exfiltrate the key for use elsewhere. (During this project, this exact risk materialized in miniature: a real key was briefly placed in the wrong file, `.env.example`, before being caught and moved — see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for the full incident and fix.)
- **Server availability/resources** — CPU, memory, and Gemini API free-tier quota (notably low: 10 RPM / 250 RPD), all consumable by a malicious or careless client.
- **Application integrity** — the deployed code and its ability to run correctly (no arbitrary code execution, no data corruption).

## Actors

- **Legitimate user** — uploads their own document, wants a summary.
- **Malicious uploader** — crafts adversarial files (oversized, malformed, decompression-bomb-style, path-traversal filenames, embedded instructions for the AI) to attack the app or the AI pipeline.
- **Network attacker** — attempts injection, header manipulation, or traffic interception (mitigated by HTTPS at the hosting layer, out of this app's direct control).
- **Automated abuse** — scripts hammering the upload or AI endpoint to exhaust resources or run up API costs.

## Trust boundaries

See [DATA_FLOW.md](DATA_FLOW.md) for the three trust boundaries (upload, validated-file, AI-prompt).

## Entry points / attack surface

1. `POST /api/summarize` — the only API route. Accepts a file and a length parameter.
2. The uploaded file itself, as input to: the MIME sniffer, `pdf-parse`, `pdfjs-dist` rasterization, `tesseract.js` OCR.
3. Extracted document text, as input to the Gemini prompt.
4. HTTP headers on any request (rate-limit key derivation, CSP nonce).

## Threats and mitigations

### 1. File upload

| Threat | Mitigation | Residual risk |
|---|---|---|
| Malicious file extension/MIME spoofing to bypass type checks | Server-side magic-byte detection (`file-type` package), never trusts client `Content-Type` or filename extension | Low — a crafted file whose actual signature genuinely matches an accepted type would still pass, but then must also survive parsing |
| Oversized upload / resource exhaustion | Header-based fast-reject (`Content-Length`) + hard streaming byte cap independent of that header (`src/lib/request-limits.ts`) + `MAX_FILE_BYTES` = 15MB | Low |
| Path traversal via filename | Filename is sanitized (`sanitizeFilename` in `src/lib/validation.ts`) and never used as a filesystem path — files are never written to disk at all | None identified |
| Malicious PDF (huge page count, malformed structure, parser crash) | Page count cap (200), corrupted-PDF errors caught and mapped to a safe message, `pdf-parse`/`pdfjs-dist` run in-process with no shell-out | Medium — a parser vulnerability in `pdfjs-dist` itself is outside this app's control; mitigated by keeping the dependency current (`npm audit` clean at time of writing) |
| Decompression-bomb-style image (huge dimensions from a small file) | OCR rendering is capped at 1600px width; `MAX_FILE_BYTES` bounds the input size | Medium — extreme aspect-ratio or dimension images aren't explicitly dimension-checked before OCR attempts a render; bounded indirectly by the file-size cap and per-page OCR timeout |

### 2. OCR

| Threat | Mitigation | Residual risk |
|---|---|---|
| Unbounded OCR processing time/CPU on a hostile scanned PDF | 15-page cap, 45s per-page timeout, 120s total budget, 1600px max render width | Low |
| OCR failure crashing the request | try/catch around OCR calls, mapped to `EXTRACTION_FAILED`/`EMPTY_EXTRACTED_TEXT` | None identified |

### 3. AI processing

| Threat | Mitigation | Residual risk |
|---|---|---|
| Prompt injection via document content ("ignore previous instructions", "reveal your system prompt") | Document text is wrapped in `<document>` tags in the user message; explicit system-prompt instruction to treat it as data; Structured Outputs constrains the response shape regardless of what the model "decides" to say | Medium — this defends the *application*, not the model's judgment; a sufficiently capable injection could still influence the model's summary content (not its ability to break out of the JSON schema or leak secrets, since none are in the prompt) |
| Secrets leaking into the prompt | The API key is never included in any prompt; verified by automated test (`tests/integration/prompt-injection.test.ts`) | None identified |
| Unbounded AI cost from huge input | Extracted text capped at 200,000 chars before reaching the AI layer, then truncated again to 60,000 chars in the provider itself | Low |
| AI provider failure/timeout/rate limit crashing the request or leaking internals | All Gemini SDK errors mapped to safe `AppError`s; verified by automated tests with a mocked SDK **and live against the real API** (missing key, invalid key, forced timeout, and a real deprecated-model 404 were all observed live and correctly mapped) | Low — the live verification covered missing/invalid key, timeout, and one real provider-error case; the Gemini-specific 429 (as opposed to the app's own rate limiter) was not observed live, only mocked (see [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md) NT-002) |

### 4. Authentication

Not applicable — this application has no accounts, no login, no sessions. This is a deliberate scope decision (stateless single-use tool), not an oversight. If accounts were added later, this section would need real content on password hashing, session management, CSRF, etc.

### 5. APIs

| Threat | Mitigation | Residual risk |
|---|---|---|
| Missing input validation | Zod schema for the `length` field; file validation as above | Low |
| Excessive requests / abuse | Per-IP rate limiting, two separate buckets (upload, AI) | Medium — in-memory limiter, ineffective across multiple serverless instances (see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md)) |
| Stack traces / internal errors leaking to the client | `AppError`/`toClientError()` chokepoint; verified by automated test | Low |

### 6. Storage

Not applicable in the traditional sense — no database, no persistent file storage. The main "storage" risk is in-memory data lingering longer than necessary; mitigated by processing being fully synchronous within one request and not caching file contents across requests.

### 7. External providers (Google Gemini)

| Threat | Mitigation | Residual risk |
|---|---|---|
| API key exposure to the client | Key read from `process.env` server-side only, in a Node-runtime route handler; never referenced in any client component | None identified |
| API key committed to source control | `.env`/`.env.local`/`.env.*.local` gitignored; `.env.example` is intentionally tracked and contains only variable names, never real values; secret-scanned at multiple points during development, including after a real incident (see the asset entry above) | None identified after the incident fix — see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for why the previous blanket `.env*` gitignore pattern was itself part of the problem |
| Data sent to a third party without disclosure | Documented explicitly in [PRIVACY_AND_DATA_HANDLING.md](PRIVACY_AND_DATA_HANDLING.md) | None identified |

## Explicitly out of scope

- Infrastructure-level DDoS protection (assumed handled by the hosting platform).
- TLS/HTTPS termination (assumed handled by the hosting platform).
- Physical/host security of wherever this is deployed.
- Multi-tenant data isolation (not applicable — no accounts, no persisted per-user data).
