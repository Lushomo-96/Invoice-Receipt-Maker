# Batch 3A — Status & Calculation Source-of-Truth Cleanup

## Scope

Batch 3A addresses the two issues identified in the Batch 3 audit:

1. Newly issued invoices with an already-past due date were stored as `unpaid` even though the UI helper derived them as `overdue`.
2. `src/db/database.ts` contained obsolete duplicate calculation/status helpers that could drift from the canonical invoice logic.

## Changes

### Centralized invoice status resolution

- Added `resolveInvoiceStatus()` to `src/utils/helpers.ts`.
- `getInvoiceStatus()` now delegates to `resolveInvoiceStatus()`.
- `InvoiceForm` uses the same resolver when saving an invoice, so the stored status and displayed status use the same rules.
- New issued invoices whose due date is already past are now stored as `overdue` immediately.
- Existing cancelled, paid, partially paid, draft, overdue and unpaid behavior remains preserved.

### Removed duplicate accounting logic

- Removed the old implementations of `calculateTotals()` and `getInvoiceStatus()` from `src/db/database.ts`.
- The database module now re-exports the canonical helpers from `src/utils/helpers.ts` for backward compatibility.
- There is now only one implementation of invoice total/status logic in the source tree.

### Derived status used consistently

The following areas now use `getInvoiceStatus()` instead of reading `invoice.status` directly:

- Documents
- Dashboard invoice totals
- Reports invoice status calculations
- Payment invoice selection
- Receipt linked-invoice selection

Draft and cancelled invoices are no longer offered as payable invoice options.

## Verification

### TypeScript

- Strict `tsc -b`: PASS
- TypeScript errors: 0
- `noUnusedLocals`: enabled
- `noUnusedParameters`: enabled

### Status test matrix

PASS:

- cancelled -> cancelled
- fully paid -> paid
- partially paid -> partially_paid
- draft -> draft
- unpaid + past due -> overdue
- unpaid + future due -> unpaid
- due at exact comparison instant -> unpaid
- newly issued + past due -> overdue

### Accounting regression matrix

PASS:

- K100 + 16% exclusive tax = K116
- K116 inclusive at 16% contains K16 VAT
- 2 x K100 - K20 discount + 16% tax = K208.80
- mixed inclusive/exclusive tax totals
- two-decimal rounding (`10.005` -> `10.01`)

### Source-of-truth audit

- Only `src/utils/helpers.ts` implements `calculateTotals()`.
- Only `src/utils/helpers.ts` implements invoice status resolution.
- No direct invoice status reads remain outside the canonical helper implementation.

## Production bundle

The final Vite bundle still cannot be completed in this Linux runtime because the supplied dependency tree does not contain the required Rolldown native binding (`@rolldown/binding-linux-x64-gnu`). This is the same environment/dependency issue documented in earlier batches and is not a new source-code failure.

## Verdict

Batch 3A passes its defined scope and is ready for independent audit before Batch 4 — Payment Engine.
