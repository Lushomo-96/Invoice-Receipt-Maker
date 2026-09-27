import type {AppSettings, DocumentSettings, FinancialSettings, InvoicePaymentTerm} from '../types';

export const INVOICE_PAYMENT_TERM_DAYS: Record<InvoicePaymentTerm, number> = {
  due_on_receipt: 0,
  '7_days': 7,
  '14_days': 14,
  '30_days': 30,
};

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  document: Object.freeze({
    invoicePrefix: 'INV',
    quotationPrefix: 'QUO',
    receiptPrefix: 'REC',
    defaultInvoicePaymentTerms: '7_days',
    defaultQuotationValidityDays: 30,
    showBusinessLogo: true,
    showBusinessTpin: true,
    showCustomerTpin: true,
    showPaymentDetails: true,
    showPaidStamp: true,
  }),
  financial: Object.freeze({
    defaultTaxRate: 0,
    defaultTaxInclusive: false,
  }),
});

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeDocumentPrefix(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.toUpperCase().trim() : '';
  const cleaned = raw
    .replace(/[^A-Z0-9_-]+/g, '')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 12);
  return cleaned || fallback;
}

export function normalizeInvoicePaymentTerm(value: unknown): InvoicePaymentTerm {
  return value === 'due_on_receipt' || value === '7_days' || value === '14_days' || value === '30_days'
    ? value
    : DEFAULT_APP_SETTINGS.document.defaultInvoicePaymentTerms;
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<AppSettings> : {};
  const document: Partial<DocumentSettings> = candidate.document && typeof candidate.document === 'object' ? candidate.document : {};
  const financial: Partial<FinancialSettings> = candidate.financial && typeof candidate.financial === 'object' ? candidate.financial : {};

  return {
    document: {
      invoicePrefix: normalizeDocumentPrefix(document.invoicePrefix, DEFAULT_APP_SETTINGS.document.invoicePrefix),
      quotationPrefix: normalizeDocumentPrefix(document.quotationPrefix, DEFAULT_APP_SETTINGS.document.quotationPrefix),
      receiptPrefix: normalizeDocumentPrefix(document.receiptPrefix, DEFAULT_APP_SETTINGS.document.receiptPrefix),
      defaultInvoicePaymentTerms: normalizeInvoicePaymentTerm(document.defaultInvoicePaymentTerms),
      defaultQuotationValidityDays: Math.min(365, Math.max(1, Math.round(finiteNumber(document.defaultQuotationValidityDays, DEFAULT_APP_SETTINGS.document.defaultQuotationValidityDays)))),
      showBusinessLogo: booleanValue(document.showBusinessLogo, DEFAULT_APP_SETTINGS.document.showBusinessLogo),
      showBusinessTpin: booleanValue(document.showBusinessTpin, DEFAULT_APP_SETTINGS.document.showBusinessTpin),
      showCustomerTpin: booleanValue(document.showCustomerTpin, DEFAULT_APP_SETTINGS.document.showCustomerTpin),
      showPaymentDetails: booleanValue(document.showPaymentDetails, DEFAULT_APP_SETTINGS.document.showPaymentDetails),
      showPaidStamp: booleanValue(document.showPaidStamp, DEFAULT_APP_SETTINGS.document.showPaidStamp),
    },
    financial: {
      defaultTaxRate: Math.min(100, Math.max(0, finiteNumber(financial.defaultTaxRate, DEFAULT_APP_SETTINGS.financial.defaultTaxRate))),
      defaultTaxInclusive: booleanValue(financial.defaultTaxInclusive, DEFAULT_APP_SETTINGS.financial.defaultTaxInclusive),
    },
  };
}

export function paymentTermDays(term: InvoicePaymentTerm): number {
  return INVOICE_PAYMENT_TERM_DAYS[term];
}
