# Batch 14 Audit — Financial Integrity & Validation

## Result
**PASS — financial-integrity hardening completed and regression-audited.**

Batch 14 is based on the independently audited Batch 13 package. The scope is deliberately concentrated on monetary-range safety, invoice/quotation input validation, payment/receipt lifecycle integrity, item-master currency integrity, backup/restore financial validation, and consistent use of the configured business currency throughout financial UI surfaces.

## Financial-core hardening
- Added a bounded safe-money range and valid JavaScript timestamp range in `src/utils/helpers.ts`.
- `roundMoney` and line calculations now fail closed with `NaN` for unsafe overflow instead of allowing `Infinity`/unsafe monetary values to propagate.
- Invoice and quotation preparation now rejects unsafe quantities, prices, discounts, shipping/document discounts, calculated totals, and invalid timestamps.
- New invoice and quotation audit timestamps are store-owned; caller-supplied creation/update timestamps cannot define the audit origin of newly created records.
- Quotation derived-value validation now requires finite safe monetary values before comparison.

## Payment / receipt integrity
- Payments must use safe positive money values and valid timestamps.
- A payment linked to an invoice cannot predate that invoice's issue date.
- Linked invoice monetary state must itself be within the safe monetary range before accepting a payment.
- Overpayment validation now reports the configured business currency rather than hard-coded ZMW.
- Standalone payments cannot reference a missing customer and use the canonical stored customer name.
- Generated payment IDs, receipt IDs, and receipt numbers are checked for collision.
- Payment reversal now validates the full reciprocal payment↔receipt relationship before mutation:
  - referenced receipt exists;
  - reciprocal payment ID/reference agrees;
  - amount agrees;
  - invoice/customer linkage agrees;
  - reversal/void state is coherent.
- Receipt voiding uses the same relationship validation while retaining the valid repair path where an already-reversed payment still has an active receipt.

## Item-master and currency integrity
- Added central item validation for identity, name/type, price, cost price, tax, stock, and currency.
- Item prices/costs must be safe non-negative money values.
- Item currency must match the business currency.
- Duplicate SKU and barcode values are rejected.
- Item creation timestamps are store-owned; edits preserve the original creation timestamp.
- Business currency can no longer be changed once priced item data or financial history exists.
- The Item form now treats business currency as authoritative rather than allowing per-item currency relabelling.

## Backup / restore validation
The backup validator now additionally rejects:
- unsafe monetary values or overflowing computed totals;
- unsafe line-item calculations;
- item currency that differs from business currency;
- invoice due dates earlier than issue dates;
- cancelled invoices without a cancellation timestamp;
- non-cancelled invoices carrying a cancellation timestamp;
- payments/receipts that predate the linked invoice;
- payments linked to Draft invoices;
- unsafe aggregate payment totals;
- broken quotation conversion linkage, customer identity, reference preservation, or converted totals.

Existing Batch 12 independent payment↔receipt↔invoice↔customer restore invariants remain in force.

## Currency-display consistency
Financial pages now consistently pass the active business currency to `formatCurrency` rather than silently falling back to ZMW. This includes dashboard/home, customer balances, invoice and quotation lists/forms, receipt/payment screens, reports, and item prices. Invoice/quotation discount helper text also reflects the active currency.

A source scan found **0 one-argument financial `formatCurrency(...)` calls** remaining under `src`.

## Runtime regression harness
**27/27 targeted runtime checks passed.**

### Money / store lifecycle — 16/16
- ordinary money rounding remains correct;
- unsafe money overflow fails closed;
- unsafe line totals fail closed;
- business setup remains valid;
- mixed-currency items are rejected;
- matching-currency items are accepted;
- business currency is locked by priced item data;
- duplicate SKU is rejected;
- overflowing invoice is rejected;
- normal invoice is accepted;
- invoice audit timestamps are store-owned;
- payment before invoice is rejected;
- overpayment message uses business currency;
- valid payment creates reciprocal receipt linkage;
- reversal voids the linked receipt;
- quotation audit timestamps are store-owned.

### Corrupted receipt-link handling — 3/3
- reversal rejects a missing referenced receipt;
- reversal rejects a receipt amount mismatch;
- reversal succeeds after the relationship is repaired.

### Backup corruption handling — 8/8
- valid live backup passes;
- mixed item currency is rejected;
- invoice due-before-issue is rejected;
- unsafe invoice money is rejected;
- payment predating invoice is rejected;
- receipt predating invoice is rejected;
- quotation conversion reference mismatch is rejected;
- cancelled invoice missing its audit timestamp is rejected.

## Static / source matrix
**36/36 checks passed.** The matrix covered safe-money/timestamp helpers, overflow guards, invoice/quotation validation, quantity bounds, store-owned audit timestamps, payment-date/currency rules, payment-receipt relationship checks, identifier collision guards, standalone customer validation, item/currency/SKU integrity, business-currency locking, restore-validation additions, UI currency locking, absence of `as any`, and configured-currency use across financial UI surfaces.

## TypeScript source gate
- TS/TSX files checked: **37**
- Isolated transpilation diagnostics: **0**
- `as any` casts: **0**

## Protected-module regression check
The following modules are byte-for-byte unchanged from independently audited Batch 13:
- `src/utils/reports.ts`
- `src/utils/dashboard.ts`
- `src/utils/documentPdf.ts`
- `src/utils/settings.ts`
- `src/utils/communication.ts`
- `src/types.ts`

Therefore Batch 14 does not change report/dashboard algorithms, PDF generation, settings semantics, communication behavior, or shared type definitions.

## Source files changed from Batch 13
**16 source files** changed:
- `src/pages/Customers/CustomerDetail.tsx`
- `src/pages/Customers/index.tsx`
- `src/pages/Home/index.tsx`
- `src/pages/Invoices/InvoiceForm.tsx`
- `src/pages/Invoices/index.tsx`
- `src/pages/Items/ItemForm.tsx`
- `src/pages/Items/index.tsx`
- `src/pages/Payments/index.tsx`
- `src/pages/Quotations/QuotationForm.tsx`
- `src/pages/Quotations/index.tsx`
- `src/pages/Receipts/ReceiptForm.tsx`
- `src/pages/Receipts/index.tsx`
- `src/pages/Reports/index.tsx`
- `src/store/useStore.ts`
- `src/utils/backup.ts`
- `src/utils/helpers.ts`

## Full build limitation
A full `npm run build` was attempted. It stops before application-source build because this execution package does not contain the required local type packages:
- `TS2688: Cannot find type definition file for 'vite/client'`
- `TS2688: Cannot find type definition file for 'node'`

This is the same dependency-tree limitation present in earlier batches. It is recorded separately and is **not** represented as a successful full Vite/browser build. The 37-file isolated TypeScript transpilation gate and 27 runtime checks are the executable validation available in this environment.

## Conclusion
**Batch 14 passes its defined Financial Integrity & Validation scope and is suitable for an independent Batch 14 audit before the next feature batch.**
