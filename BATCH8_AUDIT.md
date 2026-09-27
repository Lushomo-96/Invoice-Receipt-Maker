# Batch 8 Audit — Reports & Business Analytics

## Scope
Batch 8 replaces the placeholder Reports page with real, period-aware analytics driven by invoices, payments, reversals, receipts, quotations, customers, and validated receivable balances.

## Implemented
- Functional periods: Today, This Week, This Month, This Quarter, This Year, All Time.
- Sales invoiced from issued invoices in the selected period; draft/cancelled invoices are excluded.
- Transaction-history collection reporting:
  - Gross collections follow payment date, even if the payment is later reversed.
  - Reversals follow reversal date.
  - Net collections = gross collections - reversals.
  - This prevents a later reversal from rewriting the earlier period's collection history.
- Previous-period comparisons for Sales and Net Collections only.
- Outstanding and Overdue are clearly labelled as current remaining balances on the selected invoice cohort; no misleading historical comparison is shown.
- Active receipt count and separately dated voided-receipt corrections.
- New-customer, quotation, average-invoice, and item summary metrics.
- Payment-method breakdown with gross/reversal/net activity.
- Current receivables aging across all active invoices: Not due, 1–30, 31–60, 61–90, 90+ days.
- True Top Customers ranking by sales in the selected period, with invoice count, net collections, and current cohort outstanding.
- Legacy customer snapshot fallback so older orphaned document references are still visible in analytics.
- Invoice status mix for the selected period.
- Responsive report layout.

## Verification
- Strict TypeScript: `tsc -b` PASS, 0 errors.
- `as any` occurrences in `src/`: 0.
- Source diff from Batch 7A is limited to:
  - `src/pages/Reports/index.tsx`
  - `src/utils/reports.ts` (new)
- Report matrix PASS with test data:
  - September sales: K1,750
  - September gross collections: K500
  - September reversals: K1,000
  - September net collections: -K500
  - September current outstanding: K1,350
  - September current overdue: K1,350
- Historical event test PASS:
  - August payment K1,000 remains August gross/net collection.
  - September reversal of that payment appears as September reversal activity instead of rewriting August.
- Payment-method breakdown PASS.
- Receivables aging PASS.
- Top-customer ranking PASS, including legacy customer snapshot fallback.
- Invoice status mix PASS.

## Known environment limitation
`vite build` still stops after TypeScript because the supplied dependency tree lacks the Linux Rolldown native/WASI binding (`@rolldown/binding-linux-x64-gnu` / `@rolldown/binding-wasm32-wasi`). No Batch 8 source-level build error was exposed.

## Deferred
- CSV/PDF report export.
- Full profit/margin analytics using item cost price.
- Custom date range picker.
- Tax/VAT summary report.
- Formal receivables statements by customer.
