# Build & Release Instructions

## 1. Clean dependency install

Use a clean machine with Node/npm and registry access:

```bash
npm ci
```

Do not copy an old or partial `node_modules` directory into this project.

## 2. Run the release gates

```bash
npm run release:audit
npm run typecheck
npm run build
```

Or run the combined source/build gate:

```bash
npm run release:check
```

Expected result: all commands exit successfully and Vite creates `dist/`.

## 3. Preview the production build

```bash
npm run preview
```

Complete `RELEASE_CHECKLIST.md`, including invoice/payment/reversal, quotation conversion, PDF, backup/restore, mobile layout and deep-link tests.

## 4. Hosting requirements

- Deploy over HTTPS.
- Configure SPA rewrites so unknown server paths resolve to `index.html`.
- Test direct routes such as `/invoices/<id>`, `/quotations/<id>` and `/receipts/<id>`.
- Avoid caching `index.html` indefinitely across upgrades.
- Treat exported JSON backups as sensitive readable business/customer data.

## 5. Promotion to a final release

Only after all automated and manual gates pass should the version be promoted from `1.0.0-rc.1` to the intended final release version.
