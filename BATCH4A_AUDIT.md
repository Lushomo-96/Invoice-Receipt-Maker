# Batch 4A Audit — Financial Referential Integrity

## Scope
Batch 4A hardens invoice deletion/cancellation so financial records cannot be orphaned by normal application actions.

## Changes
- Added typed `InvoiceMutationResult` for destructive invoice actions.
- `deleteInvoice(id)` now permits deletion only when the invoice:
  - exists,
  - is still a draft,
  - has no linked payments,
  - has no linked receipts, and
  - has `amountPaid === 0`.
- Issued invoices can no longer be deleted through the store action; the action directs the user toward cancellation instead.
- Added `cancelInvoice(id)` for issued unpaid/overdue invoices with no financial transaction history.
- Cancellation preserves the invoice record and grand total, sets status to `cancelled`, sets `balanceDue` to `0`, updates `updatedAt`, and recalculates customer outstanding balances.
- Cancellation is rejected for drafts, already-cancelled invoices, and invoices with linked payments/receipts or legacy non-zero `amountPaid`.
- Invoice Detail now exposes:
  - **Delete Draft** only for drafts.
  - **Cancel Invoice** only for unpaid/overdue invoices.
  - confirmation prompts and store-result error handling for both actions.

## Verification
- Strict `tsc -b`: PASS — 0 TypeScript errors.
- `noUnusedLocals`: enabled.
- `noUnusedParameters`: enabled.
- `src/` contains 0 `as any` casts.
- Source diff against Batch 4 is limited to:
  - `src/store/useStore.ts`
  - `src/pages/Invoices/InvoiceDetail.tsx`
  - this audit note.

## Referential-integrity test matrix
PASS:
1. Unlinked draft invoice can be deleted.
2. Issued unpaid invoice cannot be deleted.
3. Issued unpaid invoice can be cancelled.
4. Cancelled invoice remains in history and has zero balance due.
5. Customer outstanding balance is recalculated after cancellation.
6. Payment-linked invoice cannot be deleted.
7. Payment-linked invoice cannot be cancelled pending reversal support.
8. Receipt-only legacy link blocks deletion and cancellation.
9. Legacy non-zero `amountPaid` blocks deletion and cancellation even if payment rows are missing.
10. Draft invoice cannot be cancelled.
11. Already-cancelled invoice cannot be cancelled again or deleted.
12. Missing invoice mutations fail without changing state.

Result: `ALL_REFERENTIAL_INTEGRITY_TESTS_PASS`.

## Full Vite build
`npm run build` reaches Vite after TypeScript passes, then stops on the same environment-specific Rolldown optional native binding problem seen in previous batches (`@rolldown/binding-linux-x64-gnu` / WASI fallback unavailable). No new TypeScript/source failure was found.

## Deferred
- Payment reversal/refund/void workflow.
- Cancellation reasons/audit trail.
- Reconciliation/migration of inconsistent pre-Batch-4 stored data.
- Finalized-document immutability rules beyond destructive deletion/cancellation.
- Low-level bulk state replacement remains a trusted import/migration surface; UI transaction actions use the guarded mutations above.
