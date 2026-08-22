# Error Catalog

All errors originate from `AppError` (`src/lib/errors.ts`) or are mapped to a generic `INTERNAL_ERROR` by `toClientError()` if they don't. No response body ever contains a stack trace, library-internal error text, or a file path — verified by automated test (`tests/unit/errors.test.ts`, `tests/integration/api-route.test.ts`).

| Code | HTTP Status | User-facing message | Internal meaning | Recovery action (user) | Logged server-side? |
|---|---|---|---|---|---|
| `NO_FILE` | 400 | "No file was provided." | Request had no `file` field in the form data | Select a file and try again | No (expected client error) |
| `INVALID_REQUEST` | 400 | "Invalid summary length requested." | The `length` field failed Zod validation | Retry with a valid length (the UI never sends an invalid one under normal use) | No |
| `INVALID_FILE_TYPE` | 415 | "Unsupported file type. Please upload a PDF, PNG, JPEG, or WEBP file." | Detected file signature (magic bytes) isn't one of the accepted types | Upload a supported file type | No |
| `FILE_TOO_LARGE` | 413 | "File exceeds the 15MB limit." | `file.size` (or the streaming byte count) exceeds `MAX_FILE_BYTES` | Upload a smaller file | No |
| `REQUEST_TOO_LARGE` | 413 | "Upload exceeds the 15MB limit." | `Content-Length` header, or actual streamed bytes, exceeded the cap before file-level validation even ran | Upload a smaller file | No |
| `EMPTY_FILE` | 422 | "The selected file is empty." | `file.size === 0` | Select a non-empty file | No |
| `EXTRACTION_FAILED` | 422 | "This PDF could not be read..." / "OCR failed to process this image." / "This scanned PDF could not be processed with OCR." | PDF parser threw, page count exceeded the cap, or OCR itself failed | Try a different file, or verify the file isn't corrupted | No (422 is below the 500-class logging threshold — see Logging policy below) |
| `EMPTY_EXTRACTED_TEXT` | 422 | "This looks like a scanned PDF with no selectable text..." / "No readable text was found in this image..." / "...even after OCR." | Extraction/OCR succeeded technically but produced no usable text | Try a clearer scan/photo, or a text-based PDF | No |
| `AI_TIMEOUT` | 504 | "The summarization service took too long to respond. Please try again." | Gemini request exceeded the 45s timeout | Retry; if it persists, try a shorter document | No |
| `AI_RATE_LIMITED` | 429 | "The summarization service is busy. Please try again shortly." | Gemini returned a 429 | Wait and retry | No |
| `AI_PROVIDER_ERROR` | 502 | "The summarization service is temporarily unavailable." | Gemini returned a 500-class error, an unrecognized error shape, or the API key is missing/misconfigured | Retry later; if persistent, this is a deployment configuration issue | Yes (all 500-class-status `AppError`s are logged) |
| `AI_INVALID_RESPONSE` | 502 | "The summarizer returned an unexpected/incomplete response. Please try again." | Model response had no parsed payload, empty `choices`, or failed Zod schema validation | Retry | Yes |
| `RATE_LIMITED` | 429 | "Too many requests. Please wait a moment and try again." | Per-IP rate limit bucket exceeded | Wait for the window to reset (5 minutes) | No |
| `INTERNAL_ERROR` | 500 | "Something went wrong while processing your request. Please try again." | Any error not wrapped as an `AppError` (unexpected exception) | Retry; if persistent, this indicates a real bug worth reporting | Yes |

## Note on the chunked-encoding upload edge case

During security review, a specific adversarial scenario was found: a client that uploads a file *without* declaring a `Content-Length` header (chunked transfer-encoding), sized such that it crosses Next.js's own internal proxy body-size handling before the app's own logic gets a clean read on it. Depending on exact timing, this can surface as either the intended `REQUEST_TOO_LARGE` (413) or a generic `INTERNAL_ERROR` (500) from a framework-level parse failure. **Both outcomes correctly reject the oversized upload with no resource exhaustion** — the difference is cosmetic (status code precision), not a security gap. This is a genuinely adversarial client behavior (real browsers always send `Content-Length` for file uploads), not something a normal user would trigger. See [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md) SEC-008 for detail.

## Logging policy

- Only errors that map to a 5xx status are logged server-side (`console.error`), with the original error object for debugging.
- Never logged: the API key, uploaded file contents, extracted document text, or AI prompt/response content.
- 4xx errors (client mistakes: bad file type, oversized file, invalid input) are not logged — they're expected, not exceptional.
