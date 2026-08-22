# OWASP Verification Matrix

Maps implemented controls to OWASP Top 10, API Security Top 10, and LLM/GenAI risk categories. Status values used: **Implemented**, **Partially implemented**, **Not applicable**, **Not verified**. No claim of full ASVS compliance is made — this is a mapping of what exists, not a certification.

## OWASP Top 10 (2025 categories as referenced in this project's brief)

| Category | Status | Notes |
|---|---|---|
| Broken Access Control | Not applicable | No accounts, no per-user resources to control access to |
| Security Misconfiguration | Implemented | Security headers via `src/proxy.ts`; strict CSP with nonce (no `unsafe-inline` for scripts); found and fixed a real misconfiguration (Next's default 10MB `proxyClientMaxBodySize`) during this engagement |
| Software Supply Chain Failures | Partially implemented | `npm audit` clean at time of writing; no automated CI dependency scanning configured (manual only, run at each verification pass) |
| Cryptographic Failures | Not applicable | No cryptographic operations performed by this app (TLS termination is the hosting platform's responsibility) |
| Injection | Implemented | XSS, path traversal, command injection, header injection, prompt injection all tested — see [PENETRATION_TEST_REPORT.md](PENETRATION_TEST_REPORT.md) |
| Insecure Design | Partially implemented | Trust boundaries documented ([THREAT_MODEL.md](THREAT_MODEL.md)); stateless-by-design scope limits several risk categories rather than requiring mitigation |
| Authentication Failures | Not applicable | No authentication implemented |
| Software or Data Integrity Failures | Partially implemented | Structured Outputs (Zod schema) validates AI responses before trusting them; no code-signing/build-integrity pipeline beyond standard `npm`/lockfile |
| Security Logging & Alerting Failures | Partially implemented | Server-side errors logged with `console.error`; no centralized/alerting log aggregation configured (out of scope for this assessment) |
| Mishandling of Exceptional Conditions | Implemented | Every error path funnels through `AppError`/`toClientError()`; verified no internal detail leaks; verified via automated test |

## OWASP API Security Top 10

| Category | Status | Notes |
|---|---|---|
| Broken Object Level Authorization (BOLA) | Not applicable | No per-user objects exist |
| Broken Authentication | Not applicable | No authentication exists |
| Broken Object Property Level Authorization | Not applicable | No object-level data model exists |
| Unrestricted Resource Consumption | Implemented | Upload size (two layers), OCR page/dimension/time budget, AI input truncation, rate limiting (with documented single-instance limitation) |
| Broken Function Level Authorization | Not applicable | Single public function (summarize), no privilege tiers |
| Server-Side Request Forgery (SSRF) | Not applicable | No user-controlled URL fetching exists in the codebase (verified by code review) |
| Security Misconfiguration | Implemented | See Top 10 row above |
| Improper Inventory Management | Implemented | Single API route, fully documented in [ARCHITECTURE.md](ARCHITECTURE.md) |
| Unsafe Consumption of APIs | Implemented | Gemini SDK responses are never trusted as-is — re-validated with Zod before use; all SDK error types mapped explicitly |

## LLM / GenAI risks (OWASP LLM Top 10-style categories, as applicable to this app's single AI integration point)

| Risk | Status | Notes |
|---|---|---|
| Prompt Injection | Partially implemented | Application-side defenses implemented and tested (role separation, delimiters, Structured Outputs) — see [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md). Not verified against a live model (requires API key) — genuinely partial, not fully resolved |
| Sensitive Information Disclosure | Implemented | No secrets ever placed in any prompt; verified by automated test |
| Insecure Output Handling | Implemented | AI response is schema-validated (Zod) before use; rendered client-side via React text interpolation only, never as HTML |
| Model Denial of Service | Implemented | Input truncated before reaching the model; request timeout (45s) and bounded retries on the AI call |
| Excessive Agency | Not applicable | The model has no tool-use/function-calling capability in this integration — it can only return the fixed summary schema, nothing else |
| Overreliance | Not applicable / product-level concern | Outside the scope of application security controls; the UI does label AI-generated content as such |
