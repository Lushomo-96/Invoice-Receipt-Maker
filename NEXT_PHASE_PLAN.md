# Next phase plan — Invoice & Receipt Maker

Prepared 2026-09-23 for version 1.0.0-rc.1.

## Starting point

- The app is a local-first React, TypeScript, Vite, Tailwind and Zustand project.
- The current installed workspace passed `npm run build` after the spacing, revenue chart and persisted-state typing changes.
- A clean `npm ci`, the combined release audit, lint, a production-preview walkthrough and deployment checks have not yet been evidenced for this source state.
- The older release status documents describe an earlier environment that could not build; keep those reports as history until new evidence is recorded.
- This extracted project folder has no `.git` directory. Do not assume a Git branch or commit is available.

## Goal

Make a release decision from reproducible build and browser evidence, then promote the release candidate only after every release blocker in `RELEASE_CHECKLIST.md` is cleared.

## Milestone 1 — Reproducible automated gate (P0)

1. In a disposable copy of the project that excludes `node_modules`, `dist` and logs, run `npm ci` with registry access.
2. Run `npm run release:check` and `npm run lint` in that copy. Record the Node and npm versions, commands, exit codes and any failures in a dated verification report.
3. If a command fails, fix the narrow cause in source or configuration and repeat the failed gate. Do not weaken the audit or type rules to obtain a pass.

**Done when:** clean installation, release audit, TypeScript build and lint pass on the same source snapshot. A prior build in the installed workspace does not close this gate.

## Milestone 2 — Revenue chart usability (P0)

1. Inspect the updated chart in `src/pages/Home/index.tsx` with no payments, one paid month, several uneven months and a six-month range crossing a year boundary.
2. Make exact monthly amounts available through a visible month selection or compact month list that works on touch and keyboard. The current SVG point title and hover hint alone do not serve touch users.
3. Check the currency scale, selected amount, empty state and horizontal overflow at 320, 375, 768 and 1280 px. Preserve the current aggregation of active payments and add no chart dependency.

**Done when:** a user can read every monthly amount without hovering, keyboard focus is clear, and the chart remains legible at those widths.

## Milestone 3 — Critical workflow smoke check (P0)

1. Serve the production build in a disposable browser profile or isolated origin. Use synthetic business and customer details; leave the user's active local data untouched.
2. Walk through every item in `RELEASE_CHECKLIST.md`: business setup and currency lock, customer/item duplicates, payment methods, invoice and PDF, partial/final payment, receipt, reversal, quotation conversion, backup export/restore, reports and long-content PDFs.
3. Compare dashboard/report totals with the created records. Check phone, tablet and desktop navigation, keyboard use and 200% zoom.
4. Record each outcome and a reproducible path for every failure. Fix blockers one at a time and repeat the affected workflow.

**Done when:** the financial, backup, PDF and responsive checks pass with evidence. A failure remains a blocker even if the page renders.

## Milestone 4 — Release documentation and hosting (P0)

1. Preview `dist/` and verify direct routes on the intended HTTPS host with SPA rewrites and an `index.html` cache policy that allows upgrades.
2. Update `RELEASE_CHECKLIST.md`, `RELEASE_STATUS.md`, `FINAL_RELEASE_STATUS.md` and `UIUX_FINAL_STATUS.md` to reflect only observed results. Distinguish the historical audit from the current verification.
3. Package source and required documentation without `node_modules`, `dist` or test data. Promote the version only after all release blockers pass and publication is requested.

**Done when:** the release notes match the verified build and host behavior, and the package can be rebuilt from its lockfile.

## After the release gate

Decide whether the dashboard period selector should also control Revenue Trend. It currently changes the dashboard metrics while the chart always shows six months. Make this a separate product decision and implementation task.
