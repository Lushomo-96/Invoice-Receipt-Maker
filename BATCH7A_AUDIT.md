# Batch 7A Audit — Dashboard Comparison Semantics

## Scope
This batch corrects the semantic issues found in the independent Batch 7 audit without changing the validated current-period dashboard accounting.

## Changes
- Removed percentage/"vs last period" comparisons from **Outstanding** and **Overdue** cards because those values are current balances for the selected invoice cohort, not reconstructed historical as-of balances.
- Outstanding now states: **Current balance for selected invoices**.
- Overdue now states: **Current overdue balance**.
- Sales and Paid retain valid previous-period comparisons.
- Dashboard search now treats partially-paid past-due invoices as searchable by `overdue`, `overdue balance`, and `past due`.
- Cancelled documents now have an explicit slate/neutral status badge instead of falling through to the generic blue style.

## Verification
- `tsc -b`: PASS, 0 TypeScript errors.
- Existing Batch 7 metric regression matrix: PASS.
- Verified current-period values remain: Sales K1,500; Paid K400; Outstanding K1,100; Overdue K600 in the reference fixture.
- Reversed payments remain excluded.
- Draft/cancelled invoice values remain excluded from financial totals.
- Partially-paid overdue invoice continues contributing only its remaining overdue balance.
- Overdue semantic search token is present.
- Cancelled status style is explicit.
- Diff from Batch 7 is limited to `src/pages/Home/index.tsx` plus this audit note.

## Production bundle
TypeScript completes successfully. The Vite bundle still stops in this Linux runtime at the previously documented missing native Rolldown binding (`@rolldown/binding-linux-x64-gnu`). No new source-level build error was exposed.

## Deferred
True historical as-of Outstanding/Overdue comparisons can be added later by reconstructing balances from dated payment/reversal ledger events. This batch intentionally avoids presenting a false comparison until that analytics layer is implemented.

## Verdict
PASS for Batch 7A scope.
