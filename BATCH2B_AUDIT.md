# Batch 2B — Invoice Status Preservation Audit

## Scope
Batch 2B corrects the edit-status regression identified during the Batch 2A audit. It intentionally does not change invoice calculations, editable dates, taxes, discounts, or overpayment handling; those remain for Batch 3.

## Fix implemented
`src/pages/Invoices/InvoiceForm.tsx` now treats new invoices and existing invoices differently when deciding status.

For an existing invoice:
- `cancelled` remains `cancelled`.
- If recorded payments cover the edited total, status becomes `paid`.
- If there is a positive payment below the edited total, status becomes `partially_paid`.
- An existing `draft` with no payments remains `draft`.
- An issued invoice with no payments and a due date in the past becomes/remains `overdue`.
- An issued invoice with no payments and a due date not yet reached becomes/remains `unpaid`.

For a new invoice:
- Save Draft creates `draft`.
- Save & Share creates `unpaid`.

This prevents the edit-mode “Save Changes” button from converting an existing `unpaid` or `overdue` invoice into `draft`.

## Verification
- Strict TypeScript: PASS (`node ./node_modules/typescript/bin/tsc -b`)
- TypeScript errors: 0
- Source diff against Batch 2A: limited to invoice status-resolution logic plus this audit file.
- Vite production bundle: not independently completed in the Linux audit environment because the supplied dependency tree lacks the platform-specific Rolldown native binding (`@rolldown/binding-linux-x64-gnu`). This is the same environment/dependency limitation seen in earlier batches.

## Deferred to Batch 3
- Overpayment/refund handling when an edited invoice total becomes lower than the amount already paid.
- Invoice issue/due-date form state.
- Line-item amount bug.
- Invoice-level discount logic.
- Tax-inclusive/exclusive logic.
- Strong invoice validation.
