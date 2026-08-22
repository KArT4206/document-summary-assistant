# Approach (≤200 words)

Document Summary Assistant is a stateless Next.js 16 (App Router, TypeScript) app. A user uploads a PDF or image; nothing is persisted server-side beyond the single request.

**Extraction:** PDFs go through `pdf-parse` for text extraction (200-page cap). If a PDF has near-zero extractable text (scanned/image-only), it's rasterized (`@napi-rs/canvas` + `pdfjs-dist`, capped at 15 pages, 1600px width) and OCR'd with Tesseract.js, within a 120s total time budget. Plain images go through the same OCR path directly.

**AI:** Summarization sits behind an `AIProvider` interface, proven swappable with two working implementations (Gemini active, OpenAI unused but functional). Google's Gemini free tier (`gemini-3.6-flash`) powers it via Structured Outputs, a hard timeout, no custom retries. Extracted text is wrapped in `<document>` tags with a system prompt treating it as untrusted data — verified live against a real adversarial document, which the model refused to obey.

**Security:** server-side magic-byte file validation, streaming body-size caps, per-IP rate limiting, strict nonce-based CSP (no `unsafe-inline`) — verified on a production build after fixing two real bugs: a CSP misconfiguration breaking hydration, and a Next.js default silently truncating 10-15MB uploads.

**UI:** full async state machine, accessible drag-and-drop, responsive layout, three lengths — live-verified to produce genuinely different output (59/143/319 words).
