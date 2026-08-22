# Data Flow

## Request lifecycle

```
USER (browser)
  │  selects/drops a file, picks a summary length
  ▼
UPLOAD  ──────────────────────────────────────────── TRUST BOUNDARY #1
  │  multipart/form-data POST to /api/summarize
  │  client-side pre-check (extension, size) is UX only — never trusted
  ▼
[ src/proxy.ts ]  security headers + CSP nonce applied
  ▼
[ rate limit: per-IP, "summarize" bucket ]  ── reject → 429
  ▼
[ body size cap: streaming, independent of Content-Length ] ── reject → 413
  ▼
VALIDATION  (src/lib/validation.ts)  ─────────────── TRUST BOUNDARY #2
  │  • size check
  │  • magic-byte MIME sniff (file-type) — NOT client-supplied MIME/extension
  │  • filename sanitized (strips path separators, control/unicode chars)
  │  reject → 415 / 422 / 400
  ▼
SECURE PROCESSING — TEXT EXTRACTION / OCR  (src/lib/extraction/extract.ts)
  │
  │  PDF ──▶ pdf-parse text layer
  │           │
  │           ├─ sufficient text (≥20 chars) ──▶ done (method: pdf-text)
  │           │
  │           └─ insufficient text (likely scanned) ──▶ OCR fallback:
  │                 rasterize up to 15 pages (@napi-rs/canvas + pdfjs-dist,
  │                 max 1600px width) ──▶ tesseract.js OCR each page
  │                 (45s/page, 120s total budget) ──▶ combine text
  │                 (method: pdf-ocr)
  │
  │  Image ──▶ tesseract.js OCR directly (method: ocr)
  │
  │  no usable text after all of the above → EMPTY_EXTRACTED_TEXT (422)
  │  extraction failure (corrupted/malformed) → EXTRACTION_FAILED (422)
  ▼
[ rate limit: per-IP, "ai" bucket, separate from upload bucket ]
  ▼
AI ANALYSIS  (src/lib/ai/openai-provider.ts) ────── TRUST BOUNDARY #3
  │  extracted text (untrusted, may contain adversarial instructions)
  │  is wrapped in explicit <document> tags in the USER message.
  │  SYSTEM message instructs the model to treat it as data, not commands.
  │  Structured Outputs (Zod schema) — model cannot return arbitrary free text.
  │  timeout 45s, bounded retries, length-specific prompt guidance.
  ▼
VALIDATED RESPONSE
  │  Zod-parsed against SummaryResultSchema — a response that doesn't match
  │  the shape (missing fields, wrong types) is rejected as AI_INVALID_RESPONSE,
  │  never passed through to the client as-is.
  ▼
USER (browser)
  │  React renders summary/keyPoints/mainIdeas/improvementSuggestions as
  │  text content (auto-escaped) — never as raw HTML.
```

## Trust boundaries

| # | Boundary | What crosses it | What's assumed untrusted on the far side |
|---|----------|------------------|-------------------------------------------|
| 1 | Browser → server | The uploaded file itself, the requested summary length | Every byte of the file; the length value is still schema-validated even though the UI only offers 3 options |
| 2 | Raw upload → validated file | File bytes | MIME type and filename as claimed by the client — verified server-side instead |
| 3 | Extracted text → AI prompt | Document content | Treated as data inside `<document>` tags, never merged into the system/instruction role |

## What is NOT persisted

- Uploaded file bytes: read into memory, processed, discarded at the end of the request. Never written to disk.
- Extracted text: kept in memory for the duration of the request only.
- Summaries: returned to the client in the HTTP response; not stored server-side.

See [PRIVACY_AND_DATA_HANDLING.md](PRIVACY_AND_DATA_HANDLING.md) for what is sent to the external Gemini API and why.
