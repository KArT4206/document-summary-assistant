# Approach (≤200 words)

Document Summary Assistant is a stateless Next.js 16 (App Router, TypeScript) app. A user drags in a PDF or image; nothing is persisted server-side beyond the single request.

**Extraction:** PDFs go through `pdf-parse` (pdfjs-dist under the hood) for text extraction, capped at 200 pages. Images go through Tesseract.js OCR with a 60s timeout. If a PDF has near-zero extractable text (a scanned/image-only PDF), the app returns a clear error rather than a silent empty summary — full PDF-page rasterization-then-OCR was out of scope for this build and is documented as a known limitation.

**AI:** Summarization sits behind an `AIProvider` interface so the vendor can be swapped without touching callers. The current implementation calls OpenAI with Structured Outputs (Zod-validated JSON schema), a hard timeout, and bounded retries. The extracted document text is wrapped in explicit `<document>` tags with a system prompt that treats it as untrusted data, not instructions — a defense against prompt injection from malicious document content.

**Security:** server-side magic-byte file validation (not client MIME/extension), size/page/character caps, per-IP rate limiting, security headers (CSP, HSTS, frame protections), and user-facing errors that never leak stack traces or internals.

**UI:** full async state machine (idle/processing/complete/error), keyboard-accessible drag-and-drop, responsive layout, short/medium/long summary lengths.
