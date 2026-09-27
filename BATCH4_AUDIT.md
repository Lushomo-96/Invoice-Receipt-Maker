# Batch 4 — Payment Engine Audit

## Scope
Batch 4 replaces the disconnected payment/receipt writes with a single payment transaction in the Zustand store.

## Implemented
- Added `recordPayment()` as the canonical payment transaction.
- Recording a linked payment now updates `amountPaid`, `balanceDue`, `status`, and `updatedAt` on the invoice.
- Payment + optional receipt + invoice update + customer outstanding balance are committed together in one state update.
- Payments cannot be recorded against draft, cancelled, or fully-paid invoices.
- Overpayments are rejected.
- Zero, negative, invalid, and future-dated payments are rejected.
- Duplicate non-empty reference numbers are rejected per invoice; standalone duplicates are checked per payer.
- Payment methods now use consistent stored codes (`cash`, `bank_transfer`, etc.).
- Payment date and notes are now persisted from the form.
- Payments can optionally generate a receipt.
- Receipt creation now uses the same `recordPayment()` path, so linked receipts update their invoice.
- Receipt payment/customer details are taken from the linked invoice when one is selected.
- Payment and receipt records cross-link through `receiptId` / `linkedInvoiceId`.
- Customer `outstandingBalance` is recalculated after invoice add/update/delete and payment operations.
- Invoice Detail now preselects its invoice on the Payments screen and hides Record Payment for draft/paid/cancelled invoices.
- Corrected a Batch 3 regression where Save Changes on an existing zero-payment issued invoice could turn it back into draft.

## Verification
- Strict `tsc -b`: PASS (0 TypeScript errors).
- `noUnusedLocals` and `noUnusedParameters` remain enabled.
- `src/` contains 0 `as any` casts.
- Direct `addPayment` / `addReceipt` store mutators were removed; payment writes go through `recordPayment()`.
- Payment engine matrix: PASS.

### Payment matrix exercised
1. Adding an issued invoice updates customer outstanding balance.
2. Partial payment updates invoice paid amount, remaining balance, status, and customer balance.
3. Receipt-generating payment creates linked PaymentRecord + Receipt records.
4. Overpayment is rejected without mutating state.
5. Duplicate invoice reference is rejected.
6. Final payment sets balance to 0 and status to paid.
7. Additional payment against a paid invoice is rejected.
8. Standalone receipt/payment succeeds without an invoice.
9. Duplicate standalone reference for the same payer is rejected.
10. Future-dated payment is rejected.
11. Invoice deletion recalculates customer outstanding balance.

## Production bundle
TypeScript compilation passes. Vite bundling in this Linux runtime still stops at the pre-existing optional native Rolldown dependency (`@rolldown/binding-linux-x64-gnu` / WASI fallback) from the supplied dependency tree. No new source-level build error was exposed.

## Deferred
- Payment reversal/refund/void workflow.
- Editing or deleting existing payment records.
- Migration/reconciliation of legacy pre-Batch-4 persisted payment data.
- IndexedDB transaction persistence (planned in the data architecture batch).
