# Batch 6 Audit — Quotations & Quote-to-Invoice Workflow

## Scope
Batch 6 rebuilds the quotation lifecycle and conversion workflow on top of the Batch 5A integrity baseline.

## Implemented
- Added a dedicated read-only quotation detail screen (`/quotations/:id`).
- Kept quotation editing on `/quotations/:id/edit`.
- Added editable quotation issue and expiry dates.
- Added customer snapshot fields (phone, address, TPIN) for new/edited quotations.
- Quotation line calculations now use the same line discount, tax-inclusive/tax-exclusive, tax and rounding helpers used by invoices.
- Added quotation-level fixed ZMW discount validation.
- Added notes and terms editing.
- Added quotation status workflow: draft, sent, accepted, rejected, dynamically expired.
- Expired quotations may be edited to extend expiry; accepted/rejected/converted quotations are locked.
- Added transactional quote-to-invoice conversion in the store.
- Conversion carries customer, items, line discounts, taxes, quote discount, notes and terms into the invoice.
- Converted invoices use the quotation number as their reference number.
- Conversion marks the quotation accepted and stores `convertedInvoiceId` / `convertedAt`.
- Double conversion is blocked.
- Rejected and expired quotations cannot be converted.
- Stale/mismatched quotation totals are blocked from conversion until the quotation is edited and saved.
- Conversion updates customer outstanding balance in the same state transaction.
- Quotation status display is centralized through `getQuotationStatus()` in Quotations, Documents and Customer Detail.
- Quotation records are deep-frozen in store and after persistence rehydration.

## Verification
- `tsc -b`: PASS, 0 TypeScript errors.
- `as any` occurrences under `src/`: 0.
- Raw financial bulk setters remain absent.
- Runtime quotation store matrix: `ALL_BATCH6_QUOTATION_STORE_TESTS_PASS`.
- Quotation persistence/refreeze test: `BATCH6_QUOTATION_REHYDRATION_PASS`.

### Runtime matrix covered
- draft -> sent
- quote -> invoice conversion
- quotation/invoice cross-linking
- conversion sets accepted status
- invoice reference copied from quote number
- converted total preservation
- customer outstanding balance update
- duplicate conversion rejection
- converted quotation edit lock
- rejected quotation conversion rejection
- expired quotation conversion rejection
- dynamic expiry status
- recovery of legacy stored `expired` after expiry extension
- stale total reconciliation block

## Build environment note
TypeScript completes successfully. Vite bundling still stops on the previously documented platform-specific Rolldown optional native binding (`@rolldown/binding-linux-x64-gnu` / WASI fallback) in this Linux audit environment. No new source-level build error was exposed.

## Deferred
- PDF/print/share output for quotations remains in the document-output batch.
- Dashboard remains hard-coded and is scheduled for the Dashboard batch.
- Settings-driven quote prefixes/default validity are scheduled for Settings.
