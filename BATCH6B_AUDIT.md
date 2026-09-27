# Batch 6B Audit — Quotation Revision State

## Scope
Batch 6B closes the lifecycle gap identified in the independent Batch 6A audit: a customer-facing quotation that had already been Sent could previously be materially edited while remaining Sent.

## Implemented behavior
- A material edit to a Sent quotation now resets it to `draft`.
- A material edit to an expired customer-facing quotation also resets it to `draft`.
- The revised quotation must be marked Sent again before it can be Accepted or Rejected.
- The form explicitly notifies the user when a revision moved the quotation back to Draft.
- Derived-only reconciliation (for example correcting stale stored subtotal/tax/total values without changing source terms) does **not** reset a Sent quotation to Draft.
- Source-identical legacy `expired` records with a future-valid expiry may still normalize to Sent for backward compatibility.

## Fields treated as customer-facing/material
A change in any of the following triggers the revision state:
- customer ID/name/phone/address/TPIN snapshot
- issue date or expiry date
- quote-level discount
- notes or terms
- item identity/name/description
- item quantity or unit price
- line discount
- tax rate or tax-inclusive flag

Derived fields (`subtotal`, `tax`, `total`, and line `amount`) are intentionally excluded from material-change detection because the store owns and recalculates them.

## Verification
- Strict `tsc -b`: PASS, 0 TypeScript errors.
- `src/` contains 0 `as any` casts.
- Material-field revision matrix: PASS.
- Sent unchanged/derived-only reconciliation remains Sent: PASS.
- Revised Draft cannot be Accepted until re-Sent: PASS.
- Revised Draft can be re-Sent: PASS.
- Expired Sent extension resets to Draft: PASS.
- Core Batch 6 lifecycle/conversion regression: PASS.
- Quotation persistence/rehydration regression: PASS.

Runtime test markers:
- `ALL_BATCH6B_REVISION_TESTS_PASS`
- `ALL_BATCH6B_LIFECYCLE_REGRESSION_PASS`
- `BATCH6A_REHYDRATION_PASS` (same persistence regression harness, now using Batch 6B source)

## Diff scope
Compared with Batch 6A, application-source changes are limited to:
- `src/store/useStore.ts`
- `src/pages/Quotations/QuotationForm.tsx`

## Known environment limitation
The TypeScript phase passes. Vite bundling cannot complete in this Linux runtime because the supplied dependency tree lacks the required Rolldown native binding (`@rolldown/binding-linux-x64-gnu` / fallback WASI binding). No new source-level build error was identified.

## Deferred backlog
Customer-reference deletion/orphan policy remains deferred to the later customer/data-integrity work. Quotation snapshots still preserve document readability if the customer master record is later unavailable.
