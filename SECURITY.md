# Security Policy

## Supported versions

This is a single-version assessment project — there is no ongoing release/support matrix. The version described in this repository's `main` branch is the only supported one.

## Scope

This policy covers the Document Summary Assistant application code in this repository: the Next.js app, its API route, and its library code under `src/`. It does not cover:

- The Google Gemini API itself (report issues there to Google).
- The hosting platform's infrastructure (report issues there to the platform provider).
- Any fork or modified deployment not matching this repository's code.

## Reporting a vulnerability

If you find a security issue in this application, please report it privately rather than opening a public issue, so it can be fixed before wide disclosure. Include:

- A description of the issue and its potential impact.
- Steps to reproduce (a minimal example is ideal).
- Any relevant logs or screenshots (with sensitive data redacted).

## Responsible disclosure

Please allow a reasonable amount of time to investigate and address a report before any public disclosure. This project has no dedicated security team or SLA — it is an assessment project — but reports will be taken seriously and addressed on a best-effort basis.

## What this project does NOT claim

This project does not claim to be "100% secure," "unhackable," or free of all vulnerabilities. See [docs/SECURITY_TEST_REPORT.md](docs/SECURITY_TEST_REPORT.md) and [docs/PENETRATION_TEST_REPORT.md](docs/PENETRATION_TEST_REPORT.md) for exactly what has been tested, what passed, and what remains untested or is a known limitation.
