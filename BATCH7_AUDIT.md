# Batch 7 Audit — Real Dashboard & Live Business Metrics

## Scope
Batch 7 replaces the placeholder Home/Dashboard data with live business data and makes the reporting-period controls functional.

## Implemented
- Removed hard-coded recent documents (John Doe / Jane Smith / Bob Wilson).
- Added live dashboard document aggregation from invoices, receipts, and quotations.
- Added reporting periods: This Week, This Month, This Quarter, This Year, All Time.
- Added comparable previous-period ranges for all non-All-Time periods.
- Sales now uses issued (non-draft, non-cancelled) invoices whose issue date is in the selected period.
- Paid now uses active, non-reversed payments whose payment date is in the selected period.
- Outstanding uses validated current remaining balances for the selected period's invoice cohort.
- Overdue uses the validated overdue-balance helper, so partially paid overdue invoices contribute only their remaining balance.
- Added live invoice/customer/receipt/quotation counts for the selected period.
- Voided receipts are excluded from receipt counts; reversed payments are excluded from Paid.
- Added live recent-document search and status filtering.
- Overdue filtering uses actual overdue balance, including partially paid overdue invoices.
- Recent document rows navigate directly to invoice, receipt, or quotation detail pages.
- Replaced dead dashboard action buttons with real navigation to Documents, Payments, and Reports.
- Removed the fake unread-notification dot from the Dashboard header.

## Period semantics
- Sales: invoice `issueDate`.
- Paid: payment `date`; reversed payments excluded.
- Outstanding / Overdue: current validated balances for invoices issued in the selected period.
- Previous-period comparisons use equivalent prior calendar-to-date ranges.
- All Time intentionally shows no fabricated previous-period percentage.

## Verification
- Strict `tsc -b`: PASS, 0 errors.
- `src/` `as any` count: 0.
- Placeholder dashboard names: 0 occurrences.
- Source diff from Batch 6C is limited to:
  - `src/pages/Home/index.tsx`
  - `src/utils/dashboard.ts` (new)
- Dashboard metric matrix: PASS.

### Metric matrix case
For September 2026 test data:
- Issued invoice sales: K1,500
- Active payments received: K400
- Outstanding: K1,100
- Overdue remaining balance: K600
- Reversed payment excluded
- Draft/cancelled invoice values excluded from Sales/Outstanding
- Voided receipt excluded from receipt count
- Partially paid overdue invoice marked as overdue for filtering

Result: `BATCH7_DASHBOARD_METRICS_PASS`.

## Full Vite build
TypeScript completes successfully. The Vite bundling stage remains blocked in this Linux environment by the same pre-existing optional Rolldown native/WASI binding issue (`@rolldown/binding-linux-x64-gnu` / `@rolldown/binding-wasm32-wasi`). No new Batch 7 source build error was exposed.

## Deferred
- Reports page period/ranking rebuild remains Batch 8.
- Export/print/share remain later document-output batches.
- Historical "as-of" outstanding snapshots are not reconstructed; Dashboard comparisons use current validated balances for each period's invoice cohort.
