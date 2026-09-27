# Independent Batch 8A Audit — Reporting Semantics & Cancellation Integrity

## Verdict

**PASS after correction.** The independent audit found a regression in the newest Batch 8A package and corrected it before Batch 9 work began.

## Regression found

The newest Batch 8A package retained the improved reporting semantics but had dropped three cancellation-integrity protections that existed in the earlier audited 8A build:

1. New invoice callers could carry a supplied `cancelledAt` field into storage.
2. Normal invoice edits could inject/replace `cancelledAt` instead of preserving the store-owned value.
3. Rehydration no longer backfilled `cancelledAt` on legacy cancelled invoices from their locked `updatedAt` timestamp.

These were restored without reverting the newer `cancellationAdjustments` / `netInvoiced` reporting model.

## Independent acceptance matrix

### Cancellation ownership and immutability
- Caller-supplied `cancelledAt` is stripped on invoice creation.
- Normal invoice edits preserve the existing `cancelledAt` value.
- `cancelInvoice()` creates the cancellation timestamp.
- `updatedAt === cancelledAt` for the cancellation event.
- Cancellation zeroes `balanceDue`.
- A second cancellation is rejected.
- Cancelled invoices remain edit-locked.
- Financial records, nested item arrays, and line items remain runtime-frozen.

### Legacy rehydration
- A persisted cancelled invoice without `cancelledAt` is backfilled from `updatedAt` during merge.
- Rehydrated financial records are sealed/frozen again.
- Report fallback also accepts legacy `updatedAt` only when it is not earlier than `issueDate`.

### Historical reporting semantics
- An August invoice cancelled in September remains in August gross `Sales invoiced`.
- September receives the cancellation adjustment.
- `Net invoiced = Sales invoiced - cancellation adjustments`.
- Cancelled invoices contribute zero current Outstanding and Overdue.
- Top Customers retains historical gross issue-period sales while current outstanding excludes the cancelled invoice.

### Aging boundaries
- Future-due invoice -> Not due.
- Newly overdue invoice -> 1-30 days immediately.
- Exact 30-day overdue boundary -> 1-30 days.
- Just beyond 30 days -> 31-60 days.

## Runtime verification

Independent runtime marker:

`BATCH8A_INDEPENDENT_RUNTIME_PASS`

26 assertions passed against the actual reporting and store logic. The store module was executed with minimal Zustand/React runtime stubs so the real mutation and persistence-merge code paths could be tested directly.

## Static integrity checks

- The corrected application source contains no `as any` cast.
- The restored cancellation protections are the same type-safe statements previously used in the audited 8A lineage.
- No document-output code was added during this correction.

## Files changed by the independent correction

- `src/store/useStore.ts`
- Added `BATCH8A_INDEPENDENT_AUDIT.md`

The newer reporting changes in `src/utils/reports.ts` and `src/pages/Reports/index.tsx` were retained.

## Result

**Batch 8A is cleared for Batch 9 — PDF & Document Output.**
