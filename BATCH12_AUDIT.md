# Batch 12 Audit — Data Architecture, Persistence & Backup/Restore

## Baseline
Built from the corrected **independently audited Batch 11** package.

## Scope
Establish one canonical local persistence architecture and add safe, versioned backup/restore without weakening the financial/audit protections from earlier batches.

## Data architecture
- **Zustand persisted local storage remains the single application source of truth.**
- The unused parallel Dexie/IndexedDB module was removed to avoid a future split-brain persistence path.
- `dexie` and `dexie-react-hooks` were removed from project dependency declarations/lock metadata because no application source used them.
- Zustand persistence now has an explicit `PERSISTENCE_VERSION = 1` and a migration hook so future schema changes have a defined upgrade boundary.
- Payment methods and notifications now receive the same clone/freeze treatment as the existing financial/master collections at mutation and rehydration boundaries.
- The business profile can no longer be cleared while customer, item, payment-method, or financial data depends on it. Clearing a genuinely empty profile also clears the authenticated flag.

## Backup format
Added `src/utils/backup.ts` with a versioned JSON envelope:
- fixed format identifier;
- backup schema version;
- persistence version;
- export timestamp;
- app version field;
- deterministic FNV-1a integrity checksum;
- complete persistent business dataset.

The checksum is explicitly treated as accidental-corruption detection, **not encryption or a security signature**.

Backup data includes:
- business profile;
- application/document/financial settings;
- payment methods;
- customers;
- items;
- invoices;
- quotations;
- payments;
- receipts;
- notifications.

UI/auth/navigation state is not treated as business data. Authentication after restore is derived from whether a business profile exists.

## Restore validation
Restore is rejected before state mutation when any of the following is detected:
- malformed or unsupported format/schema/persistence version;
- file over the 25 MB safety limit;
- checksum mismatch;
- missing/invalid business identity when business data exists;
- duplicate record IDs;
- duplicate invoice, quotation or receipt numbers;
- invalid customer/item/payment/document status/type values;
- invalid dates or negative/non-finite financial values;
- invalid tax rates, line quantities, discounts or unit prices;
- line amount mismatch against quantity/price/discount/tax;
- invoice subtotal/tax/grand-total/balance mismatch;
- quotation subtotal/tax/total mismatch;
- payment history not matching stored invoice `amountPaid`;
- missing customer/invoice/payment references;
- converted quotation pointing to a missing invoice;
- reversed payment missing reversal timestamp/reason;
- voided receipt missing void timestamp/reason;
- payment method associated with a different business profile.

Legitimate empty placeholder rows on **draft** invoices/quotations remain supported.

## Atomic restore semantics
- `restoreBackup()` performs full validation first.
- Failed validation returns without calling the store mutation path.
- Successful restore uses one persistent-state `set(...)` operation.
- Financial, quotation, customer, item, payment-method and notification collections are cloned/sealed after restore.
- Legacy cancelled invoices missing `cancelledAt` are repaired from their existing `updatedAt` timestamp, matching the established rehydration rule.
- Customer outstanding balances are recalculated from restored invoices instead of trusting a stale imported derived balance.

## User-facing Data & Backup workflow
Settings now includes a real **Data & Backup** tab:
- **Download Backup** exports the current canonical persistent dataset.
- Restore file selection validates before exposing the destructive action.
- A validated backup preview displays business/currency and record counts.
- Restore requires typing **RESTORE** exactly.
- A backup of the current live dataset is downloaded **before** the replacement restore begins.
- Restore errors explicitly state that current data remains unchanged.
- The UI warns that backup JSON contains readable customer/financial data and is not encrypted.

## Validation

### Source/invariant audit
**34/34 passed.**

Confirmed:
- **37 TS/TSX files** isolated-transpile with zero syntax diagnostics;
- **0 `as any` casts** in `src/`;
- versioned Zustand persistence and migration hook are present;
- restore validation occurs before mutation;
- persistent restore is a single atomic `set`;
- restored collections are sealed;
- Data & Backup UI includes validation, safety backup and explicit confirmation;
- unused Dexie path and dependencies are removed;
- financial calculation helpers, reports, dashboard calculations, PDF renderer, Batch 10 communication utility and communication action component remain byte-for-byte unchanged from Batch 11.

### Backup runtime harness
**20/20 passed.**

Covered:
- envelope creation/version fields;
- deep-clone snapshot behavior;
- valid round-trip parsing;
- deterministic checksum despite JSON key ordering;
- checksum tamper detection;
- derived line/subtotal/balance validation;
- orphan-reference rejection;
- payment-sum reconciliation;
- business-profile requirement;
- duplicate-number rejection;
- invalid status rejection;
- void audit requirements;
- blank draft-row compatibility;
- empty fresh dataset compatibility;
- safe filename generation;
- invalid JSON/schema rejection.

### Store-action runtime harness
**17/17 passed.**

A lightweight mocked Zustand runtime executed the real transpiled store actions and verified:
- business creation;
- invoice creation;
- frozen backup snapshots;
- business clear protection with financial history;
- backup round trip;
- malformed restore rejection;
- failed restore does not mutate live financial state;
- valid restore succeeds;
- customer outstanding balance is recalculated;
- restored persistent collections are frozen;
- payment-method and notification setters clone caller data;
- explicit empty restore works;
- business clear is blocked with master-data-only history;
- intentional empty replacement can clear all business data;
- clearing a truly empty business also clears authentication.

## Files changed from independent Batch 11
- `src/utils/backup.ts` — new canonical backup/validation layer.
- `src/store/useStore.ts` — versioned persistence, snapshot/restore actions, collection sealing, business-data invariant.
- `src/pages/Settings/index.tsx` — Data & Backup UI.
- `src/db/database.ts` — removed unused parallel Dexie persistence path.
- `package.json` / `package-lock.json` — removed unused Dexie dependency declarations.

No report, dashboard, PDF, communication, or financial calculation algorithm was changed in Batch 12.

## Environment limitation
A complete registry-restored browser dependency tree is not available in this execution environment, so this audit does not claim a full Vite/browser build. Evidence instead comes from isolated TypeScript transpilation, byte-level scope checks, dependency-free backup runtime tests, and execution of the real transpiled store actions through a lightweight mocked Zustand runtime.

## Result
**PASS — Batch 12 Data Architecture, Persistence & Backup/Restore.**

Recommended next gate: an independent Batch 12 audit before beginning the next product batch.
