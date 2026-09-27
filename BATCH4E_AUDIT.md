# Batch 4E — Immutable Financial State Exposure

## Scope
This batch closes the direct-reference mutation bypass identified in the Batch 4D audit. The raw Zustand store remains private, and financial transaction data exposed through `useStore()` is now readonly at compile time and deeply frozen at runtime.

## Changes
- Added `DeepReadonly<T>` public typing for invoices, payments, and receipts.
- `useStore()` / selector callbacks expose:
  - `readonly` invoice arrays and deeply readonly invoice objects/items.
  - `readonly` payment arrays/records.
  - `readonly` receipt arrays/records.
- Added defensive deep clone + freeze when financial records enter or change in the store.
- New invoices no longer retain aliases to caller-owned objects.
- Invoice updates/cancellations create sealed records.
- Payments and generated receipts are sealed before storage.
- Persistence `merge` reseals invoices, payments, and receipts during rehydration.
- `searchItems()` now accepts readonly collections and always returns a new mutable result array so sorting/filtering cannot mutate a frozen source collection.
- Invoice edit form clones `paymentMethods` before constructing a mutable `Invoice` payload.

## Verification

### Strict TypeScript
`tsc -b` passes with 0 errors.

Strict settings remain enabled:
- `noUnusedLocals: true`
- `noUnusedParameters: true`

`src/` contains 0 `as any` casts.

### Negative compile-time mutation test
TypeScript correctly rejects all of the following:
- `state.invoices.push(...)` — TS2339
- `state.invoices[0].balanceDue = ...` — TS2540
- `state.invoices[0].items[0].amount = ...` — TS2540
- `state.payments[0].amount = ...` — TS2540
- `state.receipts[0].amountReceived = ...` — TS2540

### Runtime immutability test
Instrumented testing of the exact Batch 4E store passed:
- invoice array frozen
- invoice object frozen
- nested invoice items array/objects frozen
- payment array/record frozen
- receipt array/record frozen
- direct mutation attempts throw
- mutating the original caller-owned invoice after `addInvoice()` does not alter stored state
- partial payment remains valid
- final payment still transitions to `paid`
- persisted values remain correct

Result: `ALL_BATCH4E_RUNTIME_TESTS_PASS`

### Persistence rehydration
Seeded persisted invoices/payments/receipts rehydrate successfully and are deep-frozen during merge.
Direct mutation of rehydrated financial records is blocked.

Result: `BATCH4E_REHYDRATION_PASS`

### Batch 4 integrity regression matrix
Reverified:
- unlinked draft deletion
- issued invoice cancellation
- cancelled invoice `balanceDue = 0`
- cancelled invoice edit rejection
- linked invoice edit rejection
- linked invoice delete rejection
- linked invoice cancel rejection
- partial payment status/balance
- payment + receipt linkage
- customer outstanding balance synchronization

Result: `ALL_BATCH4E_INTEGRITY_TESTS_PASS`

## Source scope
Compared with Batch 4D, application-source changes are limited to:
- `src/store/useStore.ts`
- `src/utils/helpers.ts`
- `src/pages/Invoices/InvoiceForm.tsx`

## Production bundle environment
`npm run build` completes the TypeScript stage, then Vite stops at the previously known native Rolldown dependency issue from the supplied cross-platform `node_modules` tree (`@rolldown/binding-linux-x64-gnu`). No new TypeScript/source build failure was found.

## Deferred
This batch intentionally does not add payment reversal/refund/correction workflows. Those are the next financial feature layer and should be implemented only through guarded actions.
