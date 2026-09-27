# Batch 4C Audit — Seal Transaction Mutation APIs

## Scope
Removed unrestricted application-state setters for the three protected transactional collections:

- `setInvoices`
- `setPayments`
- `setReceipts`

Invoices, payments, and receipts must now be changed through the guarded transaction actions (`addInvoice`, `updateInvoice`, `deleteInvoice`, `cancelInvoice`, and `recordPayment`). Validated import/migration actions remain deferred to a later data-migration/backup batch.

## Verification

- Strict TypeScript: `tsc -b` — PASS, 0 errors.
- `setInvoices`, `setPayments`, and `setReceipts` are absent from the `AppState` interface and store implementation.
- Source search confirms no remaining references to those three setters in `src/`.
- Persisted invoices, payments, and receipts rehydrate successfully from `invoice-maker-storage` without collection setter actions.
- Batch 4 payment-engine tests remain valid: partial payment, final payment, receipt creation/linking, and rejection of payment on a fully-paid invoice.
- Batch 4A referential-integrity rules remain valid: unlinked drafts can be deleted; issued invoices cannot; unlinked issued invoices can be cancelled; linked payment/receipt history prevents deletion/cancellation.
- Batch 4B finalized-edit rules remain valid: cancelled, payment-linked, receipt-linked, and legacy `amountPaid > 0` invoices reject edits; unlinked unpaid invoices remain editable with store-controlled financial fields preserved.
- Test result: `ALL_BATCH4C_INTEGRITY_TESTS_PASS`.

## Diff scope
Compared with Batch 4B, the only application source change is `src/store/useStore.ts`, removing the three raw collection setter declarations and implementations.

## Production bundle
The Vite bundle still stops at the previously documented environment-specific Rolldown native binding (`@rolldown/binding-linux-x64-gnu` / WASI fallback). TypeScript completes successfully before that point; no new source-level build failure was introduced by Batch 4C.

## Deferred
- Payment reversal/refund/void workflow.
- Validated bulk import and legacy-data reconciliation.
- Later migration away from raw persisted local data toward the planned data architecture.
