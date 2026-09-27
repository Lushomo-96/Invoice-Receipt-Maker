# Batch 6 Independent Audit — Quotations & Quote-to-Invoice Workflow

## Verdict
**Conditional pass.** The core quotation calculations, detail screen, conversion transaction, persistence/refreezing, and customer-balance integration work. Two store-level lifecycle/integrity gaps should be corrected before Batch 7.

## Independently verified
- `tsc -b`: PASS, 0 TypeScript errors.
- Strict unused checks remain enabled.
- `as any` occurrences under `src/`: 0.
- Dedicated `/quotations/:id` detail screen exists; editing remains on `/quotations/:id/edit`.
- Quotation line math uses the same invoice helpers for fixed line discounts, inclusive/exclusive tax, and two-decimal rounding.
- Issue/expiry dates are persisted and dynamic expiry is derived with `getQuotationStatus()`.
- Quotation records, nested items, and collections are deeply frozen at runtime.
- Persisted quotations rehydrate and are frozen again.
- Draft -> sent -> accepted path works.
- Accepted quotation converts to one invoice and marks the quote converted/accepted.
- Customer/item/tax/discount/notes/terms transfer to the invoice.
- Quotation number is copied to the invoice reference.
- Customer outstanding balance updates in the same conversion transaction.
- Duplicate conversion is rejected.
- Rejected conversion is rejected.
- Expired conversion is rejected.
- Expired quotation can be extended and becomes operationally `sent` again.
- Stale quotation totals are blocked from conversion.
- Source changes from Batch 5A are scoped to quotation workflow/status integration plus the new detail route.

## Finding 1 — Store lifecycle is not actually enforced
The claimed lifecycle is `draft -> sent -> accepted/rejected`, but the store currently permits:

- `draft -> accepted` directly through `setQuotationStatus()`.
- `draft -> rejected` directly.
- `draft -> invoice` directly through `convertQuotationToInvoice()`.

The Quotation Detail UI also exposes Accept/Reject and Convert to Invoice while a quotation is still a draft.

Independent runtime probes returned:

```text
DRAFT_CONVERT true
DRAFT_ACCEPT true
```

This is a workflow/integrity mismatch. If conversion is intended to imply acceptance, conversion from `sent` can reasonably remain allowed, but a draft should first be issued/sent.

## Finding 2 — Invalid/stale quotation can become terminally locked
`addQuotation()` is a public store action that currently trusts the caller and accepts malformed quotation records without store-level validation or recalculation. A direct probe successfully stored a quotation with an expired date, negative quantity, and zero/stale totals.

More importantly, a stale legacy quotation can enter this dead-end:

1. Quotation is `sent` but has stale/mismatched totals.
2. `setQuotationStatus(id, 'accepted')` succeeds without checking totals.
3. `convertQuotationToInvoice()` rejects it because totals require reconciliation.
4. `updateQuotation()` then rejects edits because accepted quotations are locked.

Independent runtime result:

```text
accept: true
convert: false
convertError: Quotation totals require reconciliation. Edit and save the quotation before conversion.
update: false
updateError: Accepted quotations are locked. Convert it to an invoice or create a replacement quotation if terms change.
```

This leaves the quote accepted but impossible to reconcile or convert.

## Recommended Batch 6A
1. Enforce quotation state transitions in the store, not only in the UI.
2. Prevent draft quotations from being accepted/rejected/converted before they are sent.
3. Before accepting a quote, validate/recalculate its items and totals; if stale, require edit/save first.
4. Harden `addQuotation()` so stored totals are derived by the store and invalid numeric/date states cannot be persisted. Incomplete drafts may remain allowed, but negative/invalid financial values should not.
5. Keep conversion from a valid `sent` quote if conversion is intended to imply acceptance, otherwise require explicit `accepted` status.
6. Normalize legacy persisted `expired` status to `sent` after a valid expiry extension to avoid raw/derived status drift.
7. Re-run conversion, expiry, readonly, persistence, and customer-balance tests.

## Build environment
TypeScript succeeds. Vite bundling still stops at the previously documented optional native Rolldown binding problem (`@rolldown/binding-linux-x64-gnu` / WASI fallback). No new Batch 6 source-level bundle error was identified before that environment failure.
