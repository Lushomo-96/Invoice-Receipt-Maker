# Invoice & Receipt Maker — Release Checklist

## Automated gates
- [ ] Run `npm ci` on a clean machine with network access.
- [ ] Run `npm run release:audit`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Serve `dist/` through the intended production host and smoke-test direct routes.

## End-to-end smoke test
- [ ] Create/edit the business profile and verify currency lock after priced/financial data exists.
- [ ] Create a customer and item; verify duplicate phone/email/SKU/barcode rejection.
- [ ] Configure cash, bank-transfer and mobile-money methods.
- [ ] Create a draft invoice, issue it, generate/download/share its PDF, and verify configured payment details.
- [ ] Record a partial payment with receipt, then a final payment; verify invoice status/balance and reports.
- [ ] Reverse a payment and verify the linked receipt is voided and balances are restored.
- [ ] Create a quotation, mark it sent, convert it to an invoice, and verify the quotation↔invoice audit link.
- [ ] Export a JSON backup, inspect the summary, then restore it in a disposable browser profile.
- [ ] Verify dashboard/reports totals against the underlying documents after restore.
- [ ] Test invoice/quotation/receipt PDFs with long customer/business/item text.

## Mobile/responsive smoke test
- [ ] 320–375 px phone viewport: bottom navigation, document cards, forms, settings, dialogs and toasts remain usable.
- [ ] Landscape phone/tablet viewport: no page-level horizontal overflow.
- [ ] Desktop: sidebar, tables and detail actions remain usable.

## Deployment requirements
- [ ] HTTPS enabled in production.
- [ ] SPA rewrite configured so deep links such as `/invoices/<id>` return `index.html`.
- [ ] Cache policy does not permanently pin an obsolete `index.html` after upgrades.
- [ ] Backups are treated as sensitive readable JSON and stored securely by the user/business.

## Release blockers
Do not publish the release if any of these fail:
- production build/typecheck;
- invoice/payment/reversal/restore smoke flows;
- PDF generation for invoice, quotation and receipt;
- backup export + restore validation;
- direct-route deployment test.
