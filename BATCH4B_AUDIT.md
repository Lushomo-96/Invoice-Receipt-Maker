# Batch 4B Audit — Finalized Invoice Edit Protection

## Scope
Batch 4B closes the integrity gap found during the Batch 4A audit: cancelled invoices and invoices with payment/receipt history could still be edited through the invoice form or direct store calls.

## Implemented safeguards
- Added a shared `getInvoiceEditLockReason()` helper so the UI and store use the same edit-lock rule.
- Cancelled invoices are locked against ordinary editing.
- Any invoice with linked payments is locked against ordinary editing.
- Any invoice with linked receipts is locked against ordinary editing.
- Legacy invoices with `amountPaid > 0` are locked even if their payment rows are missing.
- The Invoice Detail page hides the Edit action when an invoice is locked and explains why.
- Direct navigation to `/invoices/:id/edit` now shows a lock screen for protected invoices instead of the editable form.
- Invalid/missing invoice edit URLs now show an Invoice Not Found state rather than silently acting like a new invoice.
- `updateInvoice()` now returns an `InvoiceMutationResult` and rejects protected mutations at the store layer.
- `updateInvoice()` preserves store-owned invoice identity/history fields (`id`, `number`, `createdAt`, `amountPaid`) and derives `balanceDue` and status instead of trusting caller-supplied values.
- Ordinary `updateInvoice()` calls cannot be used to cancel an invoice; cancellation must go through `cancelInvoice()`.
- The cancelled-invoice invariant remains protected: a cancelled invoice cannot be edited back into a positive balance.

## Integrity matrix
Verified directly against the Batch 4B store:
- Cancelled invoice edit -> rejected; `balanceDue` remains 0.
- Partially paid/payment-linked invoice edit -> rejected.
- Receipt-only legacy linked invoice edit -> rejected.
- Legacy nonzero `amountPaid` without payment rows -> rejected.
- Unlinked unpaid invoice edit -> allowed.
- Caller attempts to overwrite invoice number -> ignored; original number preserved.
- Caller attempts to overwrite `amountPaid` -> ignored; stored payment amount preserved.
- Caller attempts to inject a false paid status -> normalized from actual financial data.
- Caller attempts to overwrite `createdAt` -> ignored; original creation time preserved.

Result: `ALL_BATCH4B_INTEGRITY_TESTS_PASS`

## Type/build verification
- `tsc -b`: PASS, 0 TypeScript errors.
- `noUnusedLocals`: enabled.
- `noUnusedParameters`: enabled.
- `src/` `as any` count: 0.
- Vite still stops on the known environment-specific missing `@rolldown/binding-linux-x64-gnu` native binding after TypeScript succeeds. No new source-level Vite error was exposed.

## Deferred
- Payment reversal/refund/void workflow remains deferred to the next payment-correction batch.
- Legacy persisted-data reconciliation remains deferred to the later data migration/architecture work.
