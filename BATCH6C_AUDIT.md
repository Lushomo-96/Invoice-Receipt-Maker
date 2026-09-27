# Batch 6C — Integrity Consolidation Audit

Baseline: Batch 6B — Quotation Revision State

## Scope

This batch closes the high-priority cross-batch integrity gaps identified by the cumulative Batches 1–6 audit before Dashboard metrics are treated as authoritative.

### 1. Invoice store validation and normalization

- Added central `prepareInvoiceForStorage()` validation in the store.
- `addInvoice()` now derives line amounts, subtotal, tax, invoice discount, shipping and grand total from invoice terms rather than trusting caller-supplied totals.
- `updateInvoice()` uses the same normalization path.
- New invoice IDs and numbers must be unique (case-insensitive number check).
- New invoices cannot start with `amountPaid > 0`; payments must go through `recordPayment()`.
- New invoices cannot start as paid/partially-paid/cancelled.
- Issued invoices must reference an existing customer; incomplete Drafts may remain repairable.
- Quote-to-invoice conversion now also passes through the canonical invoice preparation path.

### 2. Payment ledger reconciliation before new payments

Before `recordPayment()` accepts an invoice-linked payment, it now calculates the sum of all active linked payments and requires that value to equal `invoice.amountPaid`.

If legacy records disagree, the new payment is rejected without mutating invoices, payments or receipts, with a reconciliation-required error.

This matches the invariant already enforced by payment reversal.

### 3. Customer-reference integrity

- `deleteCustomer()` now rejects deletion when the customer is referenced by any invoice, quotation, payment or receipt.
- Sent/issued quotation/invoice workflows require an existing customer master record.
- Accepted quotation conversion is blocked if the customer master record is missing.
- Raw `setCustomers` and `setItems` bulk setters were removed because they were unused and could bypass guarded mutation paths.
- Customer and item collections are now defensively cloned, deeply frozen at runtime and exposed as deeply readonly through the public store hook.
- Customer/item persistence rehydration restores the frozen boundary.

### 4. Overdue-balance semantics

Added canonical helpers:

- `getInvoiceOutstandingAmount()`
- `getInvoiceOverdueBalance()`

A partially-paid invoice whose remaining balance is past due now contributes its remaining balance to overdue metrics even though its display status remains `partially_paid`.

Draft and cancelled invoices contribute zero outstanding/overdue balance.

Current Dashboard and Reports calculations were switched to these helpers without otherwise redesigning those screens.

## Verification

### Strict TypeScript

`tsc -b` — PASS, 0 errors.

- `noUnusedLocals: true` retained.
- `noUnusedParameters: true` retained.
- `as any` under `src/`: 0 occurrences.
- Raw `setCustomers`, `setItems`, `setInvoices`, `setPayments`, `setReceipts`: absent.

A compile-time negative test confirmed customer, item and financial records cannot be mutated through the public `useStore()` return value.

### Direct store regression matrix

`ALL_INTEGRITY_CONSOLIDATION_TESTS_PASS`

Covered:

- malformed invoice totals normalized on add;
- malformed invoice totals normalized on update;
- duplicate invoice ID rejection;
- duplicate invoice number rejection;
- orphan issued invoice rejection;
- repairable orphan Draft behavior;
- orphan Draft blocked from issuance;
- legacy payment-ledger mismatch blocks new payment with zero mutation;
- normal partial payment remains functional;
- referenced customer deletion blocked;
- unreferenced customer deletion succeeds;
- quotation references protect customers;
- orphan accepted quotation cannot convert;
- normal quotation lifecycle/conversion remains functional;
- converted invoice passes canonical invoice normalization;
- partially-paid overdue balance is counted correctly;
- draft/cancelled balances are excluded;
- customer master records are cloned/frozen rather than retaining caller aliases.

### Persistence

`INTEGRITY_REHYDRATION_PASS`

Customer and invoice records rehydrate successfully and return frozen at both collection and record/nested-item levels.

## Production bundle

Strict TypeScript succeeds. Vite still cannot complete in this Linux environment because the supplied dependency tree lacks the optional Rolldown Linux/WASI native binding (`@rolldown/binding-linux-x64-gnu` / WASI fallback). No new application-source bundle error was exposed.

## Changed application source files from Batch 6B

- `src/store/useStore.ts`
- `src/utils/helpers.ts`
- `src/pages/Invoices/InvoiceForm.tsx`
- `src/pages/Home/index.tsx`
- `src/pages/Reports/index.tsx`

## Verdict

**PASS for defined scope.**

The three high-priority cross-batch integrity gaps from the cumulative Batches 1–6 audit are closed. The app is now on a stronger data-integrity baseline for Batch 7 Dashboard work.

Remaining planned work is product functionality rather than a blocker in this consolidation scope: real Dashboard periods/recent documents/comparisons, full Reports filters/ranking, PDF/share output, settings behavior, data architecture/migration, and backup/restore.
