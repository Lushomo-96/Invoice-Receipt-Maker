# Invoice & Receipt Maker

A local-first React/TypeScript application for creating invoices, quotations and receipts, recording payments, viewing reports, configuring business/payment details, and exporting/restoring versioned JSON backups.

## Release candidate
Current package version: **1.0.0-rc.1**.

This package contains application source, audit lineage and a release checklist. It does not include `node_modules` or compiled `dist` output.

## Local development
```bash
npm ci
npm run dev
```

## Release verification
```bash
npm run release:audit
npm run typecheck
npm run build
```

`npm run release:check` runs the static release audit followed by the production build.

## Persistence and backups
Application data is stored locally through the Zustand persisted store. Settings → Data & Backup can export and restore the complete business dataset. Backup JSON is readable and is **not encrypted**; treat it as sensitive financial/customer information.

Restore validation checks document/payment/customer/item/payment-method references and financial invariants before atomic replacement of live data.

## Hosting
The application uses browser-history routing. Production hosting must rewrite unknown application routes to `index.html`; otherwise refreshing a deep link such as `/invoices/<id>` may return a server 404.

## Release checklist
See [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) before publishing a release.
