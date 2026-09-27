# Batch 4D Audit — Private Store Boundary

## Scope
Batch 4D removes the raw Zustand store API from application modules while preserving the existing React hook usage:

- `useStore()`
- `useStore(selector)`

The underlying store is now a private vanilla Zustand store created with `createStore()`. Application code receives only the exported wrapper hook backed by Zustand's React `useStore()` hook.

## Changes
- Replaced the exported bound store created by `create()` with a private `appStore` created by `createStore()`.
- Added an exported `useStore` hook wrapper with overloads for full-state and selector usage.
- The private `appStore` is not exported.
- No application module can access `setState`, `getState`, `subscribe`, or the persist API through `useStore`.
- Existing persisted storage key remains `invoice-maker-storage`; persisted data format is unchanged.

## Verification

### TypeScript
- `tsc -b`: PASS
- TypeScript errors: 0
- `as any` occurrences in `src/`: 0
- `noUnusedLocals`: remains enabled
- `noUnusedParameters`: remains enabled

### Public API boundary
A negative TypeScript test confirms these now fail to compile:

```ts
useStore.setState({});
useStore.getState();
```

Both produce `TS2339: Property does not exist`.

Runtime checks also confirm the exported hook has no `setState`, `getState`, `subscribe`, or `persist` properties.

### Persistence
Using a browser-like `localStorage` harness, previously persisted:
- invoices,
- payments,
- receipts,

all rehydrated successfully through Zustand persist middleware after converting to the private vanilla store.

### Financial-integrity regression matrix
PASS:
- partial payment updates invoice totals/status,
- final payment marks invoice paid,
- payment/receipt cross-link remains intact,
- paid/linked invoice edits are blocked,
- paid/linked invoice deletion is blocked,
- paid/linked invoice cancellation is blocked,
- unlinked draft deletion still works,
- unlinked issued-invoice cancellation still works,
- cancelled invoices preserve `balanceDue = 0`,
- cancelled invoice edits are blocked,
- legitimate unlinked invoice edits still work,
- invoice number remains store-controlled,
- `amountPaid` remains store-controlled,
- `createdAt` remains store-controlled,
- `balanceDue` is recalculated by the store,
- customer outstanding balances remain synchronized.

Runtime result:

```text
ALL_BATCH4D_RUNTIME_TESTS_PASS
```

## Diff scope
Compared with Batch 4C, the only application source file changed is:

- `src/store/useStore.ts`

plus this audit document.

## Environment limitation
The full Vite build and oxlint execution still stop at the same platform-specific optional native dependency problem in the uploaded dependency tree (`@rolldown/binding-linux-x64-gnu` / `@oxlint/binding-linux-x64-gnu`). Strict TypeScript compilation completes successfully before that point.

## Result
Batch 4D meets its defined goal: the transactional store is private and ordinary application modules no longer have direct raw mutation access through Zustand's static store API.
