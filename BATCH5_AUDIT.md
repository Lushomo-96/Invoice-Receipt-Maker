# Batch 5 — Payment Reversal, Receipt Corrections & Financial Corrections

## Scope completed

### Non-destructive payment reversals
- Added `reversePayment()` as a guarded store action.
- Original payment records are retained and marked `reversed` rather than deleted.
- Reversal metadata stores the reversal timestamp, reason, and optional notes.
- A payment cannot be reversed twice.
- Reversal requires a reason.

### Invoice and customer balance restoration
- Reversing an invoice-linked payment subtracts the payment from `amountPaid`.
- `balanceDue` is recalculated to the restored amount.
- Invoice status is recalculated after reversal (`paid` → `partially_paid` / `unpaid` / `overdue` as applicable).
- Customer outstanding balance is recalculated in the same state transaction.
- Inconsistent legacy data that would make `amountPaid` negative is rejected for reconciliation instead of silently clamped.

### Receipt audit integrity
- New receipts now store `paymentId` for bidirectional payment ↔ receipt linkage.
- New payments/receipts explicitly store active status.
- Reversing a payment automatically voids its linked receipt.
- Voided receipts are retained with void timestamp and reason.
- Added `voidReceipt()` for legacy standalone receipts that have no payment record.
- A receipt with an active linked payment cannot be voided directly; the payment must be reversed.
- A legacy invoice-linked receipt with no payment record is blocked and flagged for reconciliation.

### Correction workflow
- Financial corrections use reverse-and-replace rather than editing transaction history.
- Duplicate-reference validation ignores reversed payments, allowing a corrected replacement transaction to reuse the original reference.
- Historical reversed payments still prevent invoice deletion so the audit trail cannot be orphaned.
- After all active payment/receipt links are reversed/voided, invoice editing and cancellation can proceed through their guarded actions.

### User interface
- Payments page shows Active/Reversed state, reversal reason, and a Reverse action.
- Invoice Detail shows complete payment history including reversed transactions and permits reversal of active payments.
- Receipt Detail shows a prominent VOIDED state, void reason/time, and correction actions.
- Receipt list visibly distinguishes voided receipts.
- Documents displays voided receipt status.
- Customer Detail displays voided receipts accurately.
- Reports and Dashboard receipt counts exclude voided receipts from active receipt totals.

## Verification

- Strict `tsc -b`: PASS — 0 errors.
- `noUnusedLocals` and `noUnusedParameters` remain enabled.
- `src/` contains 0 `as any` casts.
- Raw transaction setters remain absent.
- Batch 4 immutable/frozen transaction architecture remains in place.

### Runtime transaction matrix
Passed:
1. Partial payment creates correct invoice/customer balances.
2. Final payment moves invoice to paid.
3. Reversing final payment restores partial balance/status.
4. Linked receipt is automatically voided.
5. Reversal metadata persists.
6. Double reversal is rejected.
7. Reversed reference can be reused by a corrected payment.
8. Reversing all payments restores full invoice/customer outstanding balance.
9. Invoice editing is available after all active financial links are cleared.
10. Invoice deletion remains blocked when historical transactions exist.
11. Invoice cancellation works after active transactions are reversed.
12. Standalone payment reversal voids its receipt.
13. Legacy standalone receipt can be voided directly.
14. Legacy invoice-linked receipt without a payment record requires reconciliation.
15. Reversal/void statuses persist to storage.
16. Rehydrated transaction arrays/records remain frozen.

Result:
- `ALL_BATCH5_REVERSAL_TESTS_PASS`
- `BATCH5_REHYDRATION_PASS`

## Production bundle

TypeScript completes successfully. Vite still cannot complete in this Linux runtime because the supplied dependency tree lacks the platform-specific Rolldown native binding (`@rolldown/binding-linux-x64-gnu`). This is the same environment issue present in earlier batches; no new source-code bundle failure was exposed.

## Deliberately deferred

- Partial payment reversal (Batch 5 reverses a complete recorded payment transaction).
- Dedicated refund/credit-note accounting distinct from reversal.
- User permissions/approval workflow for reversals.
- Full reconciliation/migration of malformed pre-Batch-4 transaction history.
- PDF rendering of VOIDED/REVERSED watermarks (document output batch).
