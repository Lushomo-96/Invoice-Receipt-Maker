# Batch 10 Audit — Sharing & Communication

## Baseline
Built from the independently checked Batch 9A responsive-PDF baseline.

## Scope
Add explicit document communication actions without mutating invoice, quotation, receipt, payment, or reporting state.

## Implemented
- Central communication utility for invoices, quotations, and receipts.
- Native PDF share continues to use the audited Batch 9/9A share path.
- Native-share failures fall back to direct PDF download; user share-sheet cancellation remains a cancellation.
- WhatsApp handoff opens a prefilled message draft; it does not mark a quotation sent or alter any document state.
- Email handoff creates a `mailto:` draft with a document subject and prefilled summary.
- Copy details copies document type/number, customer, amount, status, and a clearly labelled local-app link.
- Copy link copies the local record URL only.
- Direct PDF download remains available alongside every communication action.
- Invoice, quotation, receipt detail screens expose the communication actions.
- The Documents screen exposes the same actions for all three document types.
- Documents rows were made responsive so the expanded action set does not require a fixed desktop width.

## Local-link semantics
The shared/copied URL is explicitly labelled `Local app link`. It points to the document route in the current app origin and is not presented as a public customer portal link.

## Lifecycle safety
The Batch 10 communication layer contains no calls to:
- quotation status mutation,
- quotation conversion,
- invoice cancellation/deletion/update,
- payment creation/reversal,
- receipt voiding,
- report/store mutation.

Communication is therefore an explicit handoff only. For example, sharing a quotation does **not** silently change it from draft to sent.

## Runtime utility tests
A separate transpiled runtime harness verified 11/11 primary communication checks:
- summary title/number,
- whitespace-normalized customer,
- ZMW amount formatting,
- status inclusion,
- labelled local link,
- encoded WhatsApp draft URL,
- encoded email draft URL,
- clipboard details copy,
- copied details contain the local-link label,
- local-link copy,
- exact same-origin record URL.

Additional failure-path checks passed:
- blocked WhatsApp popup returns failure cleanly,
- denied Clipboard API with no legacy copy capability returns failure cleanly,
- relative record paths normalize to same-origin absolute URLs.

## Source verification
- TS/TSX files checked: **36**.
- Isolated TypeScript transpilation syntax diagnostics: **0**.
- `as any` occurrences in `src/`: **0**.
- New files:
  - `src/utils/communication.ts`
  - `src/components/DocumentCommunicationActions.tsx`
- Modified integration files:
  - `src/pages/Invoices/InvoiceDetail.tsx`
  - `src/pages/Quotations/QuotationDetail.tsx`
  - `src/pages/Receipts/ReceiptDetail.tsx`
  - `src/pages/Documents/index.tsx`
- PDF renderer, store, database, reports, dashboard, financial helpers, and lifecycle engine remain unchanged from Batch 9A.

## Environment limitation
A complete registry-backed dependency tree is not available in this execution environment, so the full Vite browser build is not used as evidence. Batch 10 validation uses isolated TS/TSX transpilation, source-diff isolation, lifecycle-call scanning, and direct communication-utility runtime tests.

## Result
**PASS for Batch 10 scope.**
