# Consolidated Changelog

This release candidate consolidates the staged improvement work into one application source tree.

## Foundation and document workflows

- Routing and application structure hardened.
- Invoice core, status source-of-truth and edit/finalization protection added.
- Payment engine, reversal/correction semantics and immutable financial state established.
- Quotation lifecycle, revision state and conversion integrity implemented.

## Dashboard, reports and document output

- Real dashboard/reporting semantics and historical consistency implemented.
- Invoice, quotation and receipt PDF generation added.
- Multi-page/responsive PDF layout, branding, payment information and state markings hardened.
- Native share/download fallback and document communication actions added.

## Business configuration and persistence

- Business profile and document defaults made persistent.
- Configurable numbering, tax/payment defaults and PDF visibility settings added.
- Versioned backup/restore with checksum, strict validation and atomic restore implemented.
- Restore validation expanded across financial, audit-trail and master-data references.

## Mobile and integrity hardening

- Mobile navigation, responsive tables/cards/forms and overflow protection added.
- Financial arithmetic and transaction lifecycle validation hardened.
- Currency consistency and unsafe-number protections added.
- Customer, item and payment-method master-data integrity rules added.
- Historical payment-method and item-reference protections implemented.

## Release readiness

- Production package identity and web-app metadata added.
- Error boundary and Not Found handling added.
- Reproducible release-audit command and release checklist added.
- End-to-end financial/store/backup workflow audit completed.

## UI styling hotfix
- Migrated the application stylesheet from legacy Tailwind 3 directives to Tailwind 4 CSS-first `@import "tailwindcss"` + `@theme` configuration.
- Fixes the unstyled/default-browser appearance observed during Business Setup testing.
- No business, financial, persistence, reporting, PDF, or communication logic changed.
