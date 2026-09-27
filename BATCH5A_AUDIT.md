# Batch 5A Audit — Audit-Trail Preservation & Reversal Consistency

## Scope
Batch 5A addresses the two issues found by the independent Batch 5 audit:

1. An invoice could become editable again after every linked payment had been reversed and every linked receipt voided, allowing the historical invoice to diverge from its audit trail.
2. Payment reversal only checked that the resulting `amountPaid` would not become negative; it did not verify that the invoice's stored `amountPaid` matched the sum of active linked payment records before reversing.

## Changes

### Permanent historical edit lock
- `getInvoiceEditLockReason()` now treats **any payment or receipt history** as an audit lock, including reversed payments and voided receipts.
- `updateInvoice()` checks all linked payment/receipt history, not only active transactions.
- Invoice Form and Invoice Detail use the same historical lock rule.
- Once an invoice has ever had a payment or linked receipt, ordinary editing stays locked permanently.
- After active transactions have all been reversed/voided, the original invoice may still be **cancelled** through the dedicated cancellation action, preserving the intended correction workflow: reverse → cancel → create replacement.

### Reversal reconciliation guard
Before reversing an invoice-linked payment, the store now:
- sums every active linked payment;
- rounds that sum using the canonical money helper; and
- compares it with the invoice's stored `amountPaid`.

If they differ, reversal is rejected with a reconciliation-required error and no payment/receipt/invoice state is changed.

## Verification

### Strict TypeScript
`tsc -b` — PASS, 0 errors.

`src/` contains 0 `as any` casts.

### Direct store-level regression matrix
A temporary audit-only instrumented copy of the private store was used so production source did not expose the raw Zustand API.

Result:

`ALL_BATCH5A_FULL_MATRIX_PASS`

The matrix verified:
- partial payment;
- final payment;
- payment reversal paid → partially paid;
- corrected replacement payment using the same reference after reversal;
- reversal back to zero paid;
- permanent edit lock after all transactions are reversed/voided;
- historical transaction records continue blocking invoice deletion;
- cancellation succeeds after all active transactions are reversed;
- cancelled invoice keeps `balanceDue = 0`;
- deliberately malformed legacy data where active payment total differs from `invoice.amountPaid` blocks reversal;
- the blocked legacy reversal leaves the payment active;
- persisted data rehydrates with the historical edit lock still enforced.

### Scope check
Application source changes from Batch 5 are limited to:
- `src/store/useStore.ts`
- `src/utils/helpers.ts`
- `src/pages/Invoices/InvoiceForm.tsx`
- `src/pages/Invoices/InvoiceDetail.tsx`

No unrelated feature area was modified.

### Production bundle
TypeScript completes successfully. The Vite bundling stage remains blocked in this Linux audit environment by the same pre-existing optional Rolldown native binding issue:

`@rolldown/binding-linux-x64-gnu`

No new source-level build error was exposed.

## Result
Batch 5A defined scope: PASS.
