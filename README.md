# Document Summary Assistant

Upload a PDF or image, get an AI-generated summary, key points, main ideas, and improvement suggestions. Stateless — nothing is stored server-side beyond the request that processes it.

## Features

- Drag-and-drop or file-picker upload (PDF, PNG, JPEG, WEBP, up to 15MB)
- PDF text extraction (`pdf-parse`); image OCR (`tesseract.js`)
- AI summarization with short / medium / long length control, key points, main ideas, and improvement suggestions
- Full async UI state machine: idle → processing → complete/error, with real loading and error states (no fake progress bars)
- Responsive layout, keyboard-navigable upload zone, accessible labeling
- Server-side file validation by magic bytes (not client-supplied MIME/extension)
- Per-IP rate limiting, security headers, structured error handling with no internal detail leakage

## Tech Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, OpenAI API (Structured Outputs), Zod, pdf-parse, tesseract.js.

## Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and set OPENAI_API_KEY
npm run dev
```

Open http://localhost:3000.

## Environment Variables

See [`.env.example`](.env.example):

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Server-side only. Never sent to the browser. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |

## Scripts

```bash
npm run dev     # local dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
npx tsc --noEmit  # typecheck
```

## Architecture

```
Browser (UploadZone / ProcessingState / SummaryView)
        │  multipart/form-data (file, length)
        ▼
POST /api/summarize  (Next.js Route Handler, Node runtime)
        │
        ├─ rate limit check (per-IP, in-memory)
        ├─ validateUpload()      → size + magic-byte MIME check
        ├─ extractText()         → pdf-parse (PDF) or tesseract.js (image)
        ├─ rate limit check (AI-specific)
        └─ AIProvider.generateSummary()  → OpenAI, Structured Outputs, Zod-validated
        ▼
JSON response { summary, keyPoints, mainIdeas, improvementSuggestions, ... }
```

The AI layer is behind an `AIProvider` interface (`src/lib/ai/types.ts`) — swapping providers means adding a new class, not touching the route handler.

## Security Notes

- **File validation**: extension and client MIME type are never trusted; the actual file signature is checked server-side (`file-type` package).
- **Prompt injection**: extracted document text is wrapped in explicit `<document>` tags with a system prompt instructing the model to treat it as data, never as instructions to follow.
- **Resource limits**: 15MB upload cap, 200-page PDF cap, 60s OCR timeout, 45s AI request timeout, bounded AI retries, per-IP rate limiting on both upload and AI-generation endpoints.
- **Error handling**: all API errors return a structured `{ code, message }` with a safe, user-facing message; internal errors and stack traces are logged server-side only, never returned to the client.
- **Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and a restrictive Permissions-Policy are set on every response (`next.config.ts`).
- **Secrets**: `OPENAI_API_KEY` is read from environment variables only, used server-side only, and `.env*` is gitignored. `.env.example` contains variable names only.

## Known Limitations

- **Scanned-PDF OCR is capped at 15 pages** (rasterized via `@napi-rs/canvas` + `pdfjs-dist`, then OCR'd with tesseract.js), with a 120s total processing budget and 1600px max render width, to bound CPU/memory/time on a hostile or huge scanned document. A PDF beyond that returns a partial result with a clear warning, not a silent truncation.
- **Rate limiting is in-memory**, scoped to a single server instance. A multi-instance deployment would need a shared store (e.g. Redis).
- **No authentication/accounts.** By design — this is a stateless single-use tool, not a multi-user product. Nothing uploaded is persisted or logged beyond transient processing.
- **No automated test suite yet.** Verified manually end-to-end (valid PDF, corrupted PDF, valid/empty image OCR, spoofed extension, empty file, 404, rate limiting) during development — see the `docs/APPROACH.md` for scope notes. Unit/integration/E2E tests are a natural next step.

## Privacy

Uploaded file bytes and extracted text are sent to OpenAI's API for summarization and are otherwise not persisted, logged in full, or stored by this application. No accounts, no document history, no analytics beyond default Next.js/hosting request logs.

## Deployment

Designed for Vercel (or any Node.js host supporting Next.js 16). Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) as environment variables on the hosting platform — never commit them.
