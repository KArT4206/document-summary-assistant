# UI QA Report

## Design system

`src/app/globals.css` defines semantic design tokens (registered as Tailwind utilities via `@theme inline`): `bg`, `surface`, `surface-elevated`, `border`, `border-strong`, `primary`, `primary-hover`, `primary-fg`, `text`, `text-muted`, `text-faint`, `success`/`warning`/`danger`/`info` (each with a `-bg`/`-border` pair), plus `radius-sm/md/lg/xl` and `shadow-token-sm/md`. Light values on `:root`, dark values under `prefers-color-scheme: dark`. Every component (`UploadZone`, `ProcessingState`, `SummaryView`, `page.tsx`, `not-found.tsx`, `error.tsx`) uses these tokens exclusively — no raw `slate-*`/`indigo-*` Tailwind color utilities remain in the redesigned components (verified by grep).

A shared icon set (`src/components/icons.tsx`, 13 icons, one visual language — 1.5px stroke, rounded caps, 24×24) is used consistently instead of mixed styles.

## Breakpoints tested

| Breakpoint | Width | Result |
|---|---|---|
| Narrow mobile | 320px | No horizontal overflow (automated + live screenshot, idle state) |
| Mobile | 375-390px | No horizontal overflow (automated + live screenshots: idle, processing, results with real Gemini content, error) |
| Tablet | 768px | No horizontal overflow (automated + live screenshot, results with real content) |
| Laptop | 1024px | No horizontal overflow (automated) |
| Desktop | 1440px | No horizontal overflow (automated + live screenshots: idle, results, expanded source text, all with real content) |
| Large desktop | 1920px | No horizontal overflow (automated) |

Automated via `tests/e2e/app.spec.ts` ("Responsive layout" suite, 6 breakpoints × 2 browser projects = 12 checks, all passing).

## States verified — now with real content

| State | Verified how | Result |
|---|---|---|
| Empty / idle | E2E + live screenshots at 320/390/1440px | Clean hero + upload zone, format chips wrap correctly, no overflow at any width |
| Drag-over | Code review (`UploadZone.tsx` `isDragOver` state changes border/background/icon) | Still not exercised via a real OS-level drag event (Playwright's `setInputFiles` bypasses drag entirely) — visual state verified by reading the conditional class logic, not a live screenshot |
| File selected / processing | E2E + **live screenshot with real filename and stage list** | Stage list (upload → validate → extract → analyze → generate) renders correctly, current stage highlighted, completed stages checked, spinner respects `motion-reduce` |
| **Success (summary rendered) — real content** | **Live-verified**: real Gemini-generated summary, 5 numbered key points, 2 main ideas, 3 improvement suggestions rendered and screenshotted at 390px/768px/1440px | All sections populated correctly, dominant summary card, distinct suggestions styling, no overflow/clipping at any tested width |
| Error (validation failure) | E2E + **live screenshot at 390px** (real "not a real document" upload → server-side `INVALID_FILE_TYPE`) | Error card renders with icon, message, contextual explanation, Try Again / Choose another document actions |
| Retry | E2E | Clicking either error action returns to the idle upload screen |
| Reset / new document | E2E (shares the same `handleReset` path as retry) | Verified |
| 404 | E2E + **live screenshot at 390px** | Custom 404 page renders, on-brand styling, working link back to the app |
| Global error boundary | Code review (`src/app/error.tsx`) | Not triggered live (would require forcing an uncaught render error); token-based styling and Try Again/Go Home actions verified by code review |
| Long filename | Code review (`truncate` on filename display in `SummaryView.tsx`) + live screenshot (filename fit within available width at all tested sizes, though the test document's filename wasn't long enough to force truncation visibly) | Truncation mechanism present; not visually forced with an actually-overflowing name |
| Long summary / long key point | **Live-verified** with real medium-length AI content (5-8 sentence summary, 5 key points, 3 suggestions) — wrapped correctly at all widths, no clipping | Confirmed |
| Source text view | **Live-verified**: expand/collapse toggled live at 1440px, monospace extracted text rendered in a bordered, scrollable box | Confirmed working with real extracted text |
| Copy actions + toast feedback | Code review (`useToast` hook wired to `navigator.clipboard`, button icon swaps to a checkmark for ~1.6s, global toast confirms) | Not exercised live (Playwright's headless Chromium clipboard permissions weren't granted in this pass) — the button micro-feedback and toast call sites are present and typecheck-verified |

## Controls

- Every button has a real handler — no decorative/dead buttons (`UploadZone.tsx`, `SummaryView.tsx`, `ProcessingState.tsx`, `page.tsx`, `not-found.tsx`, `error.tsx`, `Toast.tsx`).
- Disabled states: length-selector buttons and Regenerate button disable during an in-flight regenerate request (`isRegenerating`).
- Focus-visible rings present via `focus-visible:ring-2 ring-(--color-primary)` on every interactive element.
- Reduced-motion respected: processing spinner (`motion-reduce:animate-none`) and the current-stage pulse dot (`motion-safe:animate-pulse`, meaning it simply doesn't animate under reduced motion).

## Keyboard navigation

- Upload zone: focusable, activates the file picker on Enter/Space — verified by automated test.
- All buttons/links are native `<button>`/`<Link>` elements — keyboard-operable by default. The one custom `role="button"` element (the dropzone) implements `tabIndex` + `onKeyDown` explicitly.
- A full manual keyboard-only walkthrough of the populated results view was not separately performed as a distinct pass (all interactive elements in that view are native buttons, verified structurally, not tabbed through by a human).

## Accessibility semantics

- Processing state: `role="status"` + `aria-live="polite"`.
- Toast notifications: `aria-live="polite"` region, each toast `role="status"`, dismiss buttons labeled.
- Error state: `role="alert"`.
- Upload zone: `role="button"`, `aria-label`, `aria-disabled`.
- Length selector: `role="group"`, `aria-label`, `aria-pressed` per option.
- Heading hierarchy: one `<h1>` (hero value-prop headline — the brand name moved to a non-heading logotype in the header, a deliberate SaaS-pattern change), `<h2>`s for each summary section.
- No color-only information: errors/warnings/success pair color with an icon and explicit text, never color alone.

Not verified: a real screen reader was not used.

## Known gaps in this QA pass

- No real OS-level drag-and-drop test (Playwright tooling limitation, not a product gap).
- No real screen-reader walkthrough.
- Copy-to-clipboard toast feedback verified by code review, not a live clipboard-permission-granted browser session.
- Long-filename truncation not visually forced with an actually-overflowing filename (mechanism present, not stress-tested visually).
