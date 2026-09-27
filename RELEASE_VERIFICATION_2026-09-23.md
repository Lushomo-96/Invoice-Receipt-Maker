# Release verification — 2026-09-23

## Automated gates

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` | PASS | TypeScript check and Vite production bundle completed successfully on the final source state. |
| `npm run release:audit` | PASS | 18/18 checks passed after generated `dist` output was removed from the source package. |
| `npm run lint` | BLOCKED BY ENVIRONMENT | Oxlint exited before analysis with `VirtualAlloc failed`; no lint diagnostics were produced. |

The build was retried after one transient memory allocation failure during Vite chunk rendering; the next run passed. The generated `dist` directory was removed after verification because compiled output is excluded from this release source package.

## Local browser smoke evidence

- Used synthetic data only: `Northstar Studio`, Lusaka, Zambia, `demo@northstar.test`.
- Business Setup advanced to Review & Save and saved successfully.
- Save redirected to `/home` and rendered the Dashboard.
- Revenue Trend exposed six month buttons with `aria-pressed` state and exact monthly amounts.
- At a 375 × 812 viewport, the page document width was 368 px and the six month controls were present; no page-level horizontal overflow was observed.
- The empty revenue state displayed correctly when there were no payments.

## Remaining gates

- Complete a clean `npm ci` and repeat `npm run release:check` and `npm run lint` on a machine where the linter can allocate memory.
- Run the financial workflow checks in `RELEASE_CHECKLIST.md`: invoice, payments, reversal, receipt, quotation conversion, reports, PDF generation and backup restore.
- Verify production preview and intended host behavior, including HTTPS, SPA rewrites, direct routes and cache policy.
- Test the remaining responsive, keyboard, zoom and long-content cases from the release checklist.

## Decision

The current source state passes the production build, release audit and the setup-to-dashboard/chart smoke path. It remains a release candidate until the clean-install, full workflow and hosting gates are evidenced.
