# Contributing

## Development setup

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY
npm run dev
```

## Before opening a change

Run the full local verification pass and make sure it's clean:

```bash
npx tsc --noEmit     # typecheck
npm run lint          # eslint
npm run test           # unit + integration (vitest)
npm run test:e2e     # end-to-end (playwright; builds + runs a production server)
npm run build          # production build
npm audit               # dependency vulnerabilities
```

## Code quality expectations

- No `dangerouslySetInnerHTML`, no `eval`, no shell/`child_process` calls — this codebase deliberately has none of these, and additions should have a very strong justification if they introduce any.
- Every new API surface must validate its input (Zod schema) and route errors through `AppError`/`toClientError()` (`src/lib/errors.ts`) — never let a raw exception's message reach the client.
- Uploaded/user-derived content is untrusted: never trust a client-supplied MIME type or filename for a security decision; never merge untrusted text into an AI system prompt.
- Comments explain *why*, not *what* — see the existing codebase's comment style for the bar to match.

## Tests

- New library code (`src/lib/**`) should get a unit or integration test under `tests/unit/` or `tests/integration/`.
- New user-facing flows should get an E2E test under `tests/e2e/`.
- If you find and fix a real bug, add a regression test for it — see `tests/e2e/app.spec.ts`'s "Large upload regression" test for the pattern this project follows.

## Security-sensitive changes

Changes touching file validation, the AI prompt construction, rate limiting, or security headers should be paired with an update to the relevant doc in `docs/` (`SECURITY_ARCHITECTURE.md`, `THREAT_MODEL.md`) — these documents are meant to stay accurate, not aspirational.

## Pull request expectations

- Keep changes focused; avoid unrelated refactors in the same change.
- Run the full verification pass above before requesting review.
- Describe what was tested and how in the PR description — this project's docs favor "here's what I actually verified" over "this should work."
