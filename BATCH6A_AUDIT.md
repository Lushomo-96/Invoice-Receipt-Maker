# Batch 6A Audit — Quotation Lifecycle & Store Validation

## Scope
Batch 6A closes the lifecycle and validation gaps found by the independent Batch 6 audit.

## Implemented
- `addQuotation` now returns a mutation result and validates data in the store.
- New quotations may only start as `draft` or `sent`.
- Store derives quotation line amounts, subtotal, tax, discount, and total.
- Duplicate quotation IDs and numbers are rejected.
- Dates, customer requirements, item quantities/prices/discounts/tax, and quote-level discount are validated centrally.
- Status transitions are enforced:
  - Draft -> Sent
  - Sent -> Accepted or Rejected
  - Only Accepted -> Invoice conversion
- Draft -> Accepted/Rejected is blocked.
- Draft/Sent -> direct conversion is blocked.
- Acceptance verifies persisted derived totals match the line-item calculation engine; stale sent quotes must be edited/saved before acceptance.
- Rejection also validates/normalizes quotation data before finalizing.
- Legacy `expired` quotations normalize back to `sent` after a valid future expiry is saved.
- Legacy Accepted quotations with stale derived totals no longer deadlock: conversion normalizes derived totals from their unchanged accepted line-item terms.
- Quotation detail UI only shows actions valid for the current lifecycle state.
- Quotation form now handles store-level create errors.

## Verification
- Strict TypeScript: `tsc -b` PASS, 0 errors.
- `src/` contains 0 `as any` casts.
- Runtime quotation matrix: `ALL_BATCH6A_QUOTATION_TESTS_PASS`.
- Persistence/readonly rehydration: `BATCH6A_REHYDRATION_PASS`.
- Source diff from Batch 6 is limited to:
  - `src/store/useStore.ts`
  - `src/pages/Quotations/QuotationForm.tsx`
  - `src/pages/Quotations/QuotationDetail.tsx`
  - this audit note

## Runtime matrix covered
- malformed direct store add rejected
- direct accepted/rejected creation rejected
- store-derived totals and line amounts
- draft -> accepted/rejected blocked
- draft conversion blocked
- draft -> sent -> accepted -> conversion succeeds
- double conversion blocked
- stale sent totals block acceptance with zero mutation
- edit/save reconciles stale sent totals
- legacy accepted stale totals normalize during conversion
- rejected quote conversion blocked
- legacy expired quote returns to sent after validity extension
- duplicate ID/number rejection
- invalid update rejected with zero mutation
- quotation persistence rehydrates frozen/readonly records

## Production bundle
TypeScript completes successfully. Vite still stops on the same environment-specific Rolldown optional native binding (`@rolldown/binding-linux-x64-gnu`) present throughout prior batches; no new Batch 6A source error was exposed.
