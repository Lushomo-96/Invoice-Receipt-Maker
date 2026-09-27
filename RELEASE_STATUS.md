# Release Status — 1.0.0-rc.1

## Status
**RELEASE CANDIDATE — CONDITIONAL GO**

The source/runtime audit is clean, but this package should not be labelled a final production release until a clean networked build machine completes `npm ci`, `npm run typecheck`, `npm run build`, and the browser smoke tests in `RELEASE_CHECKLIST.md`.

## Passed in this audit environment
- static release audit: 18/18;
- end-to-end store/backup workflow harness: 27/27;
- TS/TSX isolated transpile: 39 files, 0 diagnostics;
- `as any` casts: 0;
- independently audited Batch 15 business/financial core unchanged;
- archive integrity: to be verified when the RC ZIP is sealed.

## Environment-blocked gate
The full TypeScript/Vite build stops before application source type-checking because the execution environment does not contain the dependency type trees for `vite/client` and `node`. This is an environment/dependency-install limitation, not evidence that the production build succeeds.

## Required before public publication
1. `npm ci`
2. `npm run release:audit`
3. `npm run typecheck`
4. `npm run build`
5. Serve the built `dist/` on the intended host with SPA rewrites enabled.
6. Complete all financial, backup/restore, PDF and mobile smoke tests in `RELEASE_CHECKLIST.md`.
