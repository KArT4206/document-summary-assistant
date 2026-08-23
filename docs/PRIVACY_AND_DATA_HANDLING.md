# Privacy and Data Handling

This document explains, in plain terms, what happens to a document you upload to this application.

## What data enters the system

- The file you upload (PDF, PNG, JPEG, or WEBP), up to 15MB.
- The summary length you choose (short/medium/long).
- Standard HTTP request metadata (IP address, via `X-Forwarded-For`/`X-Real-IP` headers if present, used only for rate-limiting — see below).

## What gets stored

**Nothing, persistently.** This application has no database and does not write uploaded files to disk. The file's bytes are read into server memory as a `Buffer`, processed (validated, text-extracted or OCR'd, sent to the AI for summarization), and the resulting summary is returned in the HTTP response. Once that response is sent, nothing about your document remains in the application's memory beyond normal process/garbage-collection cleanup.

## What gets deleted

There is nothing to delete — nothing is retained in the first place. This is different from "we delete it after 30 days"; it is "it was never written anywhere persistent to begin with."

## External AI processing

The **extracted text** of your document (not the original file bytes, not images — just the plain text pulled out of it) is normally sent to the **Google Gemini API** (free tier) to generate the summary, key points, main ideas, and improvement suggestions. This is the primary point where your document's content leaves this application's own process boundary.

- What's sent: the extracted text (truncated to at most 60,000 characters if longer), plus a short system instruction telling the model how to treat that text and what format to respond in.
- What's NOT sent: the original file itself, any metadata beyond the text content, your IP address, or any identifying information about you.
- Google's own data-handling and retention policies govern what happens to that text on their side; this document only covers what *this application* does. Consult Google's Gemini API data usage policy for their side of this — free-tier usage may be handled differently from paid-tier usage under Google's terms, so check the terms applicable to the free tier specifically.

### Fallback processing (Ollama)

This entire path is gated by `OLLAMA_FALLBACK_ENABLED`, which defaults to **disabled**. Only when it is explicitly set to `true`, and Gemini genuinely indicates quota/rate exhaustion or a transient outage, is the same extracted text (same 60,000-character-equivalent truncation, applied at a lower 24,000-character bound tuned for a smaller local model) sent to a local/private **Ollama** server (`gemma4:e4b` by default) — never to any other third party. This only happens on the fallback path; the normal path never touches Ollama at all, and when the flag is disabled no Ollama network call is attempted under any circumstance. In local development, a developer opts in by setting `OLLAMA_FALLBACK_ENABLED=true` in `.env.local`, and that Ollama server runs on the same machine as the Next.js process (`127.0.0.1:11434`); localhost Ollama is a local-development convenience only and is never a production deployment capability. In a real production deployment that wants fallback, `OLLAMA_FALLBACK_ENABLED=true` would need to be set alongside `OLLAMA_BASE_URL` pointed at a privately-reachable server operated as part of that deployment — this application does not, and must not, ever reach out to a developer's personal computer from a deployed environment. The production default (flag unset) means no such private Ollama server is assumed to exist, and the fallback path is never even attempted.

## Logs

Server-side logs (`console.error`) are written only for internal (5xx-class) failures, and contain the error object for debugging — never the uploaded file content, never the extracted text, never the AI prompt or response content, and never the API key. See [ERROR_CATALOG.md](ERROR_CATALOG.md) for the full logging policy.

## Security telemetry

Rate limiting uses the requester's IP address (from `X-Forwarded-For`/`X-Real-IP`) purely to count requests per time window, in memory, for abuse prevention. This is not persisted, not linked to any other data, and is discarded automatically after each rate-limit window expires. No device fingerprinting, no browser fingerprinting, no cookies, and no tracking of any kind are used by this application.

## User controls

Because nothing is persisted, there is no "delete my data" feature to build — there is no stored data to delete. Closing the browser tab or navigating away discards everything client-side as well (the summary exists only in that page's in-memory React state).

## No unsupported legal claims

This document describes what the code actually does, verified by reading `src/lib/extraction/extract.ts`, `src/lib/ai/gemini-provider.ts`, `src/lib/ai/ollama-provider.ts`, `src/lib/ai/router.ts`, and `src/app/api/summarize/route.ts` — it is not a substitute for a lawyer-reviewed privacy policy, and makes no claims about legal compliance (GDPR, CCPA, or otherwise) beyond the factual description of data flow above.
