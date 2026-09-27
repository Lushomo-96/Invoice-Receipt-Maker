# Batch 2 Audit — Routing & Business Setup

## Scope
Batch 2 was limited to first-run routing, business profile access, route consistency, and broken edit/detail navigation. Accounting calculations and transaction logic were intentionally left for later batches.

## Fixes completed
- Moved `/business` outside the protected application shell so first-run users can actually reach Business Setup.
- Replaced the previous top-level redirect trap with a protected layout that gates the main app only when no business profile exists.
- Kept the global toast renderer outside the protected layout so setup notifications work on `/business`.
- Removed the first-run **Skip** action because it could only route back into the setup guard. Existing businesses now get a **Cancel** action that returns to Settings.
- Business Setup now creates a fully typed `Business` object instead of using `as any`.
- Existing business profiles preserve their ID and extended fields when edited.
- Added a route-aware current-page sync so the layout title/sidebar state follows direct navigation and browser navigation.
- Made the business card in the sidebar open `/business` for profile editing.
- Added `/customers/:id/edit` and fixed the Customer Detail edit button.
- Added item edit routes and fixed item-row navigation.
- Added `/invoices/:id/edit`; fixed Invoice Preview and Invoice Detail edit navigation.
- Added quotation detail/edit routes using the existing quotation form, and made the customer selector controlled during editing.
- Added `/receipts/:id` and a read-only Receipt Detail page so generated receipt navigation no longer lands on a missing route.
- Receipt rows, customer receipt records, and Documents receipt records now open the selected receipt.
- Customer quotation records now open the selected quotation.

## Verification
- `tsc -b`: PASS with strict unused checks enabled.
- Route-source audit: all newly introduced edit/detail destinations have matching routes.
- Diff review: changes are limited to routing/setup/navigation plus the new read-only Receipt Detail page.

## Environment limitation
The full Vite bundle and oxlint cannot be independently completed in this Linux workspace because the uploaded dependency tree lacks Linux native optional bindings for Rolldown/Oxlint. This is the same dependency-platform issue observed in Batch 1A; it is not a TypeScript source failure.

## Deferred intentionally
- Invoice/payment/receipt accounting integration.
- Invoice and quotation calculation/date bugs.
- Real authentication/backend account security.
- PDF/share implementation.
- Settings persistence beyond business-profile routing.
