# Batch 8A Audit — Reporting Semantics & Aging Correction

## Result

**PASS for Batch 8A scope.** The two findings from the independent Batch 8 audit are corrected without changing the earlier payment/reversal integrity model.

## Changes

### 1. Receivables aging boundary corrected

`buildReceivablesAging()` now checks the due-date cutoff directly:

- `now <= dueDate` → **Not due**
- `now > dueDate` → at least **1 day overdue**
- elapsed overdue time uses `Math.ceil()` with a minimum of 1 day

This prevents an already-overdue invoice from remaining in **Not due** for its first partial day overdue. Boundary checks cover newly overdue, 30-day, and 31-day cases.

### 2. Dated invoice cancellation event

`Invoice` now has optional `cancelledAt`.

`cancelInvoice()` records one timestamp and uses it for both:

- `cancelledAt`
- `updatedAt`

The cancellation continues to set `status = cancelled` and `balanceDue = 0` and remains subject to the existing payment/receipt-history integrity rules.

The new field is included automatically in persisted invoice records. Runtime persistence verification passed.

### 3. Legacy cancellation compatibility

Reports use `cancelledAt` when available. For older cancelled invoices without it, `updatedAt` is used as the best available cancellation-event timestamp, provided it is not earlier than `issueDate`.

### 4. Historical invoicing semantics

Reports now separate invoice issue activity from later cancellation activity:

- **Sales invoiced** = gross value of invoices issued in the selected period. A later cancellation does not rewrite the issue-period total.
- **Cancellation adjustments** = value of invoices cancelled in the selected period, based on the cancellation event timestamp.
- **Net invoiced** = Sales invoiced − Cancellation adjustments.
- **Outstanding / Overdue** remain current balances and therefore continue to exclude cancelled invoices through the shared balance helpers.

This means an August invoice cancelled in September remains part of August gross invoicing and appears as a September cancellation adjustment.

### 5. Reports UI clarification

The Reports screen now:

- shows **Net invoiced** as a secondary metric;
- includes invoice cancellation adjustments in the period corrections notice;
- explicitly explains that issue dates, cancellation dates, payment dates, and reversal dates drive their respective report events.

## Verification

### Strict TypeScript

`node ./node_modules/typescript/bin/tsc -b`

**PASS — 0 TypeScript errors.**

`as any` count in `src/`: **0**.

### Reporting semantics matrix

Runtime test result:

`BATCH8A_REPORTING_SEMANTICS_PASS`

Verified:

- newly overdue invoice immediately enters 1–30 days;
- future-due invoice remains Not due;
- exact 30-day overdue boundary remains 1–30;
- just beyond 30 days moves to 31–60;
- August issue + September cancellation leaves August Sales invoiced unchanged;
- September receives the cancellation adjustment;
- same-period issue + cancellation produces gross Sales invoiced plus equal cancellation adjustment and zero Net invoiced;
- legacy cancelled invoice falls back to `updatedAt`;
- malformed legacy cancellation timestamp earlier than issue date is ignored.

### Store cancellation event

Runtime store test results:

- `BATCH8A_STORE_CANCELLATION_EVENT_PASS`
- `BATCH8A_CANCELLATION_PERSISTENCE_PASS`

Verified:

- cancellation creates a real `cancelledAt` timestamp;
- `updatedAt` matches the cancellation event timestamp;
- cancelled invoice balance is zero;
- `cancelledAt` is serialized by Zustand persistence.

### Source diff scope

Compared with Batch 8, only these application files changed:

- `src/types.ts`
- `src/store/useStore.ts`
- `src/utils/reports.ts`
- `src/pages/Reports/index.tsx`

### Vite production bundle

TypeScript completes successfully. Vite still stops at the same pre-existing environment dependency issue involving the missing Rolldown native/WASI binding (`@rolldown/binding-linux-x64-gnu` / `rolldown-binding.wasi.cjs`). No new application-source bundling error was exposed.

## Batch 8A verdict

**PASS.** The aging defect is fixed and invoice cancellations are now represented as dated reporting events, preventing later cancellations from silently rewriting prior-period gross invoicing.
