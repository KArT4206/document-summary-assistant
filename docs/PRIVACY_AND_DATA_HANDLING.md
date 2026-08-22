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

The **extracted text** of your document (not the original file bytes, not images — just the plain text pulled out of it) is sent to the **Google Gemini API** (free tier) to generate the summary, key points, main ideas, and improvement suggestions. This is the one point where your document's content leaves this application's own process boundary.

- What's sent: the extracted text (truncated to at most 60,000 characters if longer), plus a short system instruction telling the model how to treat that text and what format to respond in.
- What's NOT sent: the original file itself, any metadata beyond the text content, your IP address, or any identifying information about you.
- Google's own data-handling and retention policies govern what happens to that text on their side; this document only covers what *this application* does. Consult Google's Gemini API data usage policy for their side of this — free-tier usage may be handled differently from paid-tier usage under Google's terms, so check the terms applicable to the free tier specifically.

## Logs

Server-side logs (`console.error`) are written only for internal (5xx-class) failures, and contain the error object for debugging — never the uploaded file content, never the extracted text, never the AI prompt or response content, and never the API key. See [ERROR_CATALOG.md](ERROR_CATALOG.md) for the full logging policy.

## Security telemetry

Rate limiting uses the requester's IP address (from `X-Forwarded-For`/`X-Real-IP`) purely to count requests per time window, in memory, for abuse prevention. This is not persisted, not linked to any other data, and is discarded automatically after each rate-limit window expires. No device fingerprinting, no browser fingerprinting, no cookies, and no tracking of any kind are used by this application.

## User controls

Because nothing is persisted, there is no "delete my data" feature to build — there is no stored data to delete. Closing the browser tab or navigating away discards everything client-side as well (the summary exists only in that page's in-memory React state).

## No unsupported legal claims

This document describes what the code actually does, verified by reading `src/lib/extraction/extract.ts`, `src/lib/ai/gemini-provider.ts`, and `src/app/api/summarize/route.ts` — it is not a substitute for a lawyer-reviewed privacy policy, and makes no claims about legal compliance (GDPR, CCPA, or otherwise) beyond the factual description of data flow above.
