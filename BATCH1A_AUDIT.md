# Batch 1A Audit / Cleanup

## Result
PASS for the Batch 1A source-quality target.

## Verified
- `noUnusedLocals: true` restored.
- `noUnusedParameters: true` restored.
- 102 TypeScript TS6133 unused-code errors cleaned.
- `node node_modules/typescript/bin/tsc -b --pretty false` completes with zero TypeScript errors.
- Documents tabs now use a typed `as const` tab list; the previous `setTab(t as any)` cast is removed.
- Generic object-wide search was replaced with selector-driven search.
- Explicit searchable fields are defined for Customers, Invoices, Items, Quotations, and Documents.

## Deferred intentionally
Older `as any` casts remain in form save handlers for Business, Customer, Item, Invoice, and Quotation records. Those casts hide incomplete model construction and should be removed in the relevant business-logic/data-model batches rather than by fabricating missing financial fields during this cleanup batch.

## Production bundle verification
The final Vite bundle could not be independently executed in this Linux environment because the uploaded dependency tree contains Windows native Rolldown/Tailwind/LightningCSS binaries and the Linux optional native bindings are absent. A targeted dependency install was attempted but timed out. This does not affect the successful strict TypeScript source check.

For local verification after extraction:

```bash
npm install
npm run build
```
