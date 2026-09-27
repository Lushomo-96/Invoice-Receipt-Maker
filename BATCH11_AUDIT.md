# Batch 11 Audit — Settings & Business Profile

## Baseline
Built from the independently audited Batch 10 Sharing & Communication package.

## Scope
Convert the Settings and Business Profile areas from mostly placeholder controls into persisted, validated application behavior while preserving historical financial records.

## Implemented

### Business profile
- Settings now edits a local draft and saves only when **Save Business Profile** is pressed; typing no longer mutates the live business record.
- Business name and currency remain required.
- Logo upload/removal supports PNG/JPEG up to 1 MB.
- Business type, TPIN, registration number, tax registration number, additional identifier, phone, email, website, slogan, address, town/city and country are editable.
- Business records are normalized, cloned and deep-frozen at the store boundary.
- Guided Business Setup now checks the guarded store result instead of assuming every save succeeds.
- Default currency changes are blocked once invoices, quotations, receipts or payments exist. This prevents a profile edit from relabelling historical financial documents in another currency.

### Persisted document settings
New persisted defaults:
- invoice prefix,
- quotation prefix,
- receipt prefix,
- default invoice payment terms,
- default quotation validity days,
- show/hide business logo on PDFs,
- show/hide business TPIN on PDFs,
- show/hide customer TPIN on invoices/quotations,
- show/hide selected invoice payment details,
- show/hide the PAID IN FULL invoice notice.

Prefixes are uppercased, stripped of unsafe characters/separators, bounded to 12 characters and safely fall back to INV / QUO / REC.

### Financial defaults
- Default tax rate for newly created invoice/quotation line items.
- Default tax-inclusive state for newly created line items.
- Tax rate is normalized to 0–100%.
- Existing line items and historical totals are not rewritten when defaults change.

### Settings integration
- New invoices use the configured invoice prefix and payment-term/due-date default.
- New invoice rows use the configured tax defaults.
- New quotations use the configured quotation prefix, validity period and tax defaults.
- Quotation-to-invoice conversion uses the configured invoice prefix and invoice payment terms.
- Generated receipts use the configured receipt prefix.
- All invoice/quotation/receipt PDF and share entry points now pass the persisted document-display settings.
- Existing documents keep their stored numbers/dates; changing defaults affects future creation only.

### Settings migration and integrity
- Settings are included in Zustand persistence.
- Missing/legacy settings rehydrate to compatibility-preserving defaults.
- Rehydrated settings are normalized and deep-frozen.
- Rehydrated business profiles are normalized and deep-frozen.
- Default PDF visibility values preserve the pre-Batch-11 document appearance.
- Default tax remains 0% until the user explicitly chooses another rate, avoiding an unexpected tax increase for existing users.

## Removed placeholder behavior
The former fake Settings controls were removed from this scope:
- alert-only business save,
- non-persisted document switches,
- non-persisted default tax/discount/payment controls,
- non-functional theme/language/account/subscription/sign-out controls.

Only settings with real persisted behavior are exposed.

## Validation

### Source / wiring audit
**36/36 checks passed.**
- TS/TSX source files: **37**.
- Isolated TypeScript transpilation syntax diagnostics: **0**.
- `as any` occurrences in `src/`: **0**.
- Source changes are isolated to the expected Batch 11 settings/profile/PDF/default-integration files.
- Reports, dashboard calculations, shared financial helpers, database schema, Batch 10 communication utility and communication action component remain unchanged.
- All PDF creation/share call sites pass settings.

### Settings normalization runtime harness
**17/17 passed.**
Verified:
- default settings,
- unsafe/trailing prefix cleanup,
- empty-prefix fallback,
- prefix length bound,
- payment-term fallback,
- quotation-validity clamp,
- boolean migration defaults,
- tax clamp,
- legacy undefined-settings migration,
- payment-term day mapping.

### Store runtime harness
**15/15 passed.**
Verified:
- default settings present,
- settings deep-frozen,
- custom settings persist through the action boundary,
- business save and business freeze,
- accepted quotation conversion,
- configured invoice prefix on conversion,
- configured payment terms/due period on conversion,
- currency change blocked after financial history,
- standalone receipt generation,
- configured receipt prefix.

### PDF settings runtime harness
**11/11 passed.**
Verified both enabled and disabled states for:
- business logo,
- business TPIN,
- customer TPIN,
- payment details,
- PAID IN FULL notice,
- source invoice data remains unchanged.

## Files changed from Batch 10
- `src/types.ts`
- `src/utils/settings.ts` (new)
- `src/store/useStore.ts`
- `src/utils/documentPdf.ts`
- `src/pages/Settings/index.tsx`
- `src/pages/BusinessSetup/index.tsx`
- `src/pages/Invoices/InvoiceForm.tsx`
- `src/pages/Invoices/InvoiceDetail.tsx`
- `src/pages/Invoices/InvoicesPreview.tsx`
- `src/pages/Quotations/QuotationForm.tsx`
- `src/pages/Quotations/QuotationDetail.tsx`
- `src/pages/Receipts/ReceiptDetail.tsx`
- `src/pages/Documents/index.tsx`

## Environment limitation
A complete registry-restored dependency tree is not available in this execution environment, so a full Vite/browser build is not used as evidence. Validation instead uses isolated TypeScript transpilation, source-diff isolation, direct settings/store runtime harnesses and a mocked jsPDF runtime harness.

## Result
**PASS for Batch 11 scope.**

Recommended next gate: an independent Batch 11 audit before beginning the next major data/persistence batch.
