# Batch 2A — Safe Edit Preservation Audit

## Scope
Batch 2A fixes data-loss risks exposed when Batch 2 made edit routes reachable. It intentionally does not redesign invoice calculations, date inputs, quotation conversion, or payment recording; those remain scheduled for later batches.

## Changes completed

### Customers
- Editing a customer now preserves `outstandingBalance` instead of resetting it to 0.
- Editing preserves the original `createdAt` timestamp.
- "Save & Invoice" now safely updates an existing customer before opening a new invoice.
- Removed `as any`; save payload is typed as `Customer`.

### Items
- Editing an item preserves its original `createdAt` timestamp.
- Removed `as any`; save payload is typed as `Item`.

### Quotations
- Editing preserves the original quotation number.
- Editing preserves `issueDate`, `expiryDate`, `createdAt`, `status`, and existing notes.
- Only `updatedAt` is refreshed on save.
- Edit-mode button says "Save Changes" instead of "Save Draft".
- Removed `as any`; save payload is typed as `Quotation`.

### Invoices
- Editing preserves `amountPaid`.
- `balanceDue` is recalculated from the edited grand total minus the preserved amount paid, never below zero.
- Paid/partially-paid state is recalculated from the preserved payment amount and edited total.
- Cancelled invoices preserve cancelled status.
- Existing overdue state is preserved when still overdue and unpaid.
- Editing preserves invoice number, issue date, due date, reference number, purchase-order number, payment methods, attachment, and `createdAt`.
- Only `updatedAt` is refreshed on save.
- Edit-mode button says "Save Changes" and toast says "Invoice updated".
- Removed `as any`; save payload is typed as `Invoice`.

## Verification
- `noUnusedLocals: true` remains enabled.
- `noUnusedParameters: true` remains enabled.
- Strict TypeScript compile: `tsc -b` — PASS, 0 errors.
- No remaining `as any` casts under `src/` after this batch.
- Diff against Batch 2 is limited to four form files:
  - `src/pages/Customers/CustomerForm.tsx`
  - `src/pages/Items/ItemForm.tsx`
  - `src/pages/Invoices/InvoiceForm.tsx`
  - `src/pages/Quotations/QuotationForm.tsx`

## Known environment limitation
The full Vite bundle cannot be independently completed in this Linux container because the supplied dependency tree lacks the required Rolldown Linux native binding (`@rolldown/binding-linux-x64-gnu`). This is the same cross-platform dependency limitation seen in prior batches and occurs after TypeScript succeeds.

## Deferred to later batches
- Invoice quantity/unit-price calculation bug.
- User-controlled issue/due dates.
- Full tax and discount model.
- Strong invoice validation.
- Payment transaction engine.
- Quotation-to-invoice data transfer.
- Dynamic overdue-state derivation.
