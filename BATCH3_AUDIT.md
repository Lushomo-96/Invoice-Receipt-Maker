# Batch 3 Audit — Invoice Core Calculations

## Scope
Batch 3 focuses on invoice calculation integrity, editable invoice dates, tax/discount consistency, validation, and safe editing when payments already exist.

## Implemented
- Fixed line amount recalculation for quantity, unit price, discount, tax, and tax-inclusive changes.
- Added two-decimal monetary rounding through a shared `roundMoney()` helper.
- Added tax-inclusive handling so inclusive tax is extracted rather than added twice.
- Split tax reporting into added tax and included tax while retaining aggregate tax on the invoice record.
- Added editable invoice-level fixed discount and shipping fields.
- Applied invoice-level discount consistently to the final total.
- Added controlled Issue Date and Due Date fields that persist to saved invoices.
- Due dates are stored at end-of-day to avoid invoices becoming overdue during their selected due date.
- Added canonical payment-term values (due on receipt, 7, 14, 30 days, custom) and automatic due-date calculation.
- Invoice preview now uses the persisted issue date rather than the current date.
- Invoice preview now shows line discounts, invoice discount, tax added, and tax included clearly.
- Added validation for customer, dates, item name, quantity, unit price, line discounts, tax rate, invoice discount, shipping, and positive issued totals.
- New drafts may remain incomplete, while issued invoices and edits require full validation.
- Prevented editing an invoice total below the amount already paid.
- Preserved paid amounts and recalculated balance due safely after edits.
- Existing drafts can remain drafts when saved as drafts, but Save & Share promotes a valid draft to unpaid/overdue as appropriate.
- Shared invoice status helper now preserves `draft` status when displaying draft invoices.
- Added optional `taxInclusive` to `InvoiceItem` for backward compatibility with older saved records.
- Updated quotation line recalculation to use the corrected shared line math so the shared helper does not regress quotation amounts.

## Calculation model
- Line discount: fixed ZMW amount.
- Invoice discount: fixed ZMW amount applied after line totals/tax and before shipping.
- Tax: percentage per line.
- Tax-exclusive price: tax is added after the line discount.
- Tax-inclusive price: tax is extracted from the discounted line price and is not added again.
- Monetary results are rounded to two decimal places.

## Verification
- `tsc -b`: PASS, 0 TypeScript errors.
- `noUnusedLocals`: remains enabled.
- `noUnusedParameters`: remains enabled.
- `src/` contains 0 `as any` casts.
- Calculation matrix passed for:
  - 16% exclusive tax.
  - 16% inclusive tax.
  - fixed line discount before exclusive tax.
  - fixed line discount with inclusive tax.
  - fractional-price rounding.
  - mixed inclusive/exclusive lines.
- Full Vite bundling remains blocked in this Linux audit environment by the previously identified missing Rolldown native optional binding (`@rolldown/binding-linux-x64-gnu`). This occurs after TypeScript verification and is not a new Batch 3 source error.

## Deferred
- Actual PDF generation and sharing remain later batches.
- Payment recording/atomic invoice-payment updates remain Batch 4.
- Full quotation workflow redesign remains Batch 6.
- Mobile invoice form redesign remains Batch 14.
