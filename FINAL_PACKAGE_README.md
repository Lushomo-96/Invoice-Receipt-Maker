# Invoice & Receipt Maker — Consolidated Final Project Package

**Version:** 1.0.0-rc.1  
**Package status:** Release Candidate — conditional go

This folder is the single consolidated application after the full staged hardening workflow. The application source in `src/` is the canonical implementation; earlier batch ZIPs are not required to run or continue development.

## What is included

- Complete React/Vite application source.
- Invoice, quotation, receipt, customer, item, payment and reporting workflows.
- Immutable financial lifecycle protections and transaction audit rules.
- Business profile, numbering, PDF settings and payment-method configuration.
- PDF generation, download/share, WhatsApp/email handoff and document communication actions.
- Responsive/mobile navigation and document layouts.
- Versioned local backup/restore with checksum and integrity validation.
- Master-data and payment-method integrity guards.
- App-level crash recovery, Not Found handling and release metadata.
- Historical batch and independent audit reports.
- Release audit script and final release checklist.

## Important release status

The source/runtime audits are clean, but this package should remain labelled **1.0.0-rc.1** until a clean networked machine completes the external build and browser/device smoke-test gates in `BUILD_AND_RELEASE.md`.

## Start here

1. Read `FINAL_RELEASE_STATUS.md`.
2. Run the commands in `BUILD_AND_RELEASE.md`.
3. Complete `RELEASE_CHECKLIST.md` before public deployment.
4. Use `AUDIT_INDEX.md` when reviewing the audit lineage.
