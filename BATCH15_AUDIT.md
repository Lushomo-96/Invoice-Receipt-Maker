# Batch 15 Audit — Master Data Integrity & Payment Configuration

## Result
**PASS**

Batch 15 was built from the independently audited Batch 14 baseline. The batch closes master-data integrity gaps around customers, items, payment methods, invoice payment instructions, and backup/restore referential integrity without changing the shared financial calculation engine.

## Scope implemented

### Customer master integrity
- Customer creation timestamps are store-owned rather than caller-owned.
- Customer outstanding balances are derived from invoice state and cannot be overwritten by forms.
- Customer IDs are collision-checked.
- Duplicate non-empty phone numbers are rejected centrally.
- Duplicate non-empty email addresses are rejected centrally, case-insensitively.
- Customer form save paths now surface central store failures instead of navigating after a rejected mutation.

### Item reference integrity
- An item referenced by invoice or quotation history cannot be deleted.
- Invoice and quotation store mutations reject non-empty `itemId` references that no longer exist in the item master.
- Backup restore rejects orphaned invoice/quotation item references.
- Backup restore rejects duplicate non-empty SKUs and barcodes.

### Payment-method configuration
- Removed the raw `setPaymentMethods` mutation boundary.
- Added validated add/update/delete payment-method APIs.
- Payment methods are scoped to the active business by the store; caller-provided business IDs are not trusted.
- Bank transfer methods require bank name + account number.
- MTN/Airtel/Zamtel mobile-money methods require a phone number.
- Irrelevant fields are cleared when method type changes.
- Equivalent bank-transfer or same-network mobile-money duplicates are rejected.
- A payment method referenced by any invoice cannot be edited or deleted; users add a replacement for future invoices instead. This preserves regenerated historical PDF payment instructions.
- Settings now contains a real Payment Methods management tab and visibly marks methods locked by invoice history.

### Invoice payment instructions
- New invoices default to the currently configured payment methods.
- Invoice forms provide explicit per-invoice select/clear controls.
- Selected payment-method IDs are persisted on the invoice.
- Store mutations reject duplicate payment-method IDs and references to missing methods.
- Existing invoices preserve their stored selections during edit.

### Backup/restore hardening
Restore validation now also rejects:
- payment methods with missing/different business ownership;
- duplicate bank-transfer account configurations;
- duplicate same-network mobile-money configurations;
- invoice payment-method references to missing master records;
- duplicate payment-method references on one invoice;
- invoice/quotation item references to missing item master records.

## Audit matrix

### Source/invariant checks — 38/38 PASS
Verified:
- raw payment-method setter removed;
- guarded payment-method CRUD APIs present;
- business scoping and required payment details enforced;
- equivalent-method duplicate guards present;
- invoice-history locks present in store and UI;
- customer audit/derived fields protected;
- customer duplicate contact guards present;
- item history deletion guard present;
- runtime invoice/quotation master-reference guards present;
- backup master/reference duplicate guards present;
- invoice payment-method selector is wired to persistence;
- Settings payment-method management is wired;
- customer form surfaces rejected store operations;
- protected calculation/PDF/settings/report modules remain unchanged.

### Direct store runtime tests — 19/19 PASS
Includes:
- payment method requires business;
- customer audit/balance ownership;
- duplicate phone/email blocking;
- valid item + invoice master references;
- missing item reference rejection;
- item history deletion protection;
- bank/mobile payment-method validation;
- equivalent payment-method duplicate rejection;
- missing invoice payment-method reference rejection;
- valid unreferenced payment-method update/delete behavior.

### Payment-history preservation tests — 5/5 PASS
- bank payment method accepted;
- type changes clear irrelevant details;
- invoice can persist a configured payment method;
- referenced payment method cannot be edited;
- referenced payment method cannot be deleted.

### Backup validation tests — 12/12 PASS
Includes duplicate customer contact, SKU/barcode, incomplete/duplicate payment-method configuration, orphan item references, orphan invoice payment-method references, and valid referenced payment-method restoration.

## Type/source gates
- TS/TSX source files checked: **37**
- isolated syntax/transpile diagnostics: **0**
- `as any` casts: **0**
- semantic core compile (`types`, helpers, settings, backup, store) with audit-only dependency shims: **PASS**
- semantic compile of changed UI surfaces (Customer Form, Invoice Form, Settings) with audit-only dependency shims: **PASS**

## Regression isolation
Compared with independently audited Batch 14, application-source changes are limited to:
- `src/store/useStore.ts`
- `src/utils/backup.ts`
- `src/pages/Customers/CustomerForm.tsx`
- `src/pages/Invoices/InvoiceForm.tsx`
- `src/pages/Settings/index.tsx`

The following protected modules are byte-for-byte unchanged:
- `src/utils/helpers.ts`
- `src/utils/documentPdf.ts`
- `src/utils/settings.ts`
- `src/pages/Reports/index.tsx`

No shared financial arithmetic, report aggregation, PDF-layout algorithm, or document-settings schema was changed.

## Environment limitation
A genuine full project `tsc -p tsconfig.app.json` / Vite build still stops before application type-checking because the packaged dependency tree is missing the `vite/client` type definition. Batch 15 therefore records isolated syntax, semantic core/UI checks, and direct runtime tests separately and does not claim a full Vite production build.

## Conclusion
**Batch 15 passes its implementation audit and is suitable for an independent Batch 15 audit.**
