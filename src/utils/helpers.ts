import type { Invoice, InvoiceItem, PaymentRecord, Quotation, Receipt } from '../types';

export function formatCurrency(amount: number, currency = 'ZMW'): string {
  return `${currency} ${amount.toLocaleString('en-ZM', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export const MAX_SAFE_MONEY = Number.MAX_SAFE_INTEGER / 100;
export const MAX_VALID_TIMESTAMP = 8_640_000_000_000_000;

export function isSafeMoneyAmount(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_SAFE_MONEY;
}

export function isValidTimestamp(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= MAX_VALID_TIMESTAMP;
}

export function roundMoney(value: number): number {
  if (!isSafeMoneyAmount(value)) return Number.NaN;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function generateDocumentNumber(prefix: string, existingIds: string[]): string {
  const numbers = existingIds
    .filter((id) => id.startsWith(prefix + '-'))
    .map((id) => {
      const num = id.replace(prefix + '-', '');
      const yearNum = num.length > 6 ? parseInt(num.substring(0, 4)) : null;
      return yearNum ? parseInt(num.substring(4)) : parseInt(num);
    })
    .filter((n) => !isNaN(n));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${prefix}-${String(max + 1).padStart(5, '0')}`;
}

interface CalculableLineItem {
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  taxInclusive?: boolean;
}

export function calculateLineAmounts(item: CalculableLineItem) {
  const quantity = Number.isFinite(item.quantity) ? Math.max(item.quantity, 0) : 0;
  const unitPrice = Number.isFinite(item.unitPrice) ? Math.max(item.unitPrice, 0) : 0;
  const grossRaw = quantity * unitPrice;
  const requestedDiscountRaw = Number.isFinite(item.discount) ? Math.max(item.discount, 0) : 0;
  const taxRate = Number.isFinite(item.tax) ? Math.max(item.tax, 0) / 100 : 0;

  if (!isSafeMoneyAmount(grossRaw) || !isSafeMoneyAmount(requestedDiscountRaw)) {
    return { grossAmount: Number.NaN, discountAmount: Number.NaN, taxAmount: Number.NaN, addedTax: Number.NaN, includedTax: Number.NaN, lineTotal: Number.NaN };
  }

  const grossAmount = roundMoney(grossRaw);
  const requestedDiscount = roundMoney(requestedDiscountRaw);
  const discountAmount = Math.min(requestedDiscount, grossAmount);
  const discountedAmount = roundMoney(Math.max(grossAmount - discountAmount, 0));

  if (taxRate === 0) {
    return { grossAmount, discountAmount, taxAmount: 0, addedTax: 0, includedTax: 0, lineTotal: discountedAmount };
  }

  if (item.taxInclusive) {
    const taxAmount = roundMoney(discountedAmount - discountedAmount / (1 + taxRate));
    return { grossAmount, discountAmount, taxAmount, addedTax: 0, includedTax: taxAmount, lineTotal: discountedAmount };
  }

  const taxRaw = discountedAmount * taxRate;
  if (!isSafeMoneyAmount(taxRaw)) {
    return { grossAmount, discountAmount, taxAmount: Number.NaN, addedTax: Number.NaN, includedTax: 0, lineTotal: Number.NaN };
  }
  const taxAmount = roundMoney(taxRaw);
  const lineTotal = roundMoney(discountedAmount + taxAmount);
  return { grossAmount, discountAmount, taxAmount, addedTax: taxAmount, includedTax: 0, lineTotal };
}

export function recalculateInvoiceItem(item: InvoiceItem): InvoiceItem {
  const { lineTotal } = calculateLineAmounts(item);
  return { ...item, amount: lineTotal };
}

export function calculateTotals(items: readonly CalculableLineItem[]) {
  const totals = items.reduce(
    (result, item) => {
      const line = calculateLineAmounts(item);
      result.subtotal += line.grossAmount;
      result.totalDiscount += line.discountAmount;
      result.totalTax += line.taxAmount;
      result.addedTax += line.addedTax;
      result.includedTax += line.includedTax;
      result.itemsTotal += line.lineTotal;
      return result;
    },
    { subtotal: 0, totalDiscount: 0, totalTax: 0, addedTax: 0, includedTax: 0, itemsTotal: 0 },
  );

  return {
    subtotal: roundMoney(totals.subtotal),
    totalDiscount: roundMoney(totals.totalDiscount),
    totalTax: roundMoney(totals.totalTax),
    addedTax: roundMoney(totals.addedTax),
    includedTax: roundMoney(totals.includedTax),
    itemsTotal: roundMoney(totals.itemsTotal),
  };
}

export type InvoiceStatusInput = Pick<Invoice, 'status' | 'grandTotal' | 'amountPaid' | 'dueDate'>;

export function resolveInvoiceStatus(invoice: InvoiceStatusInput, now = Date.now()): Invoice['status'] {
  if (invoice.status === 'cancelled') return 'cancelled';
  if (invoice.grandTotal > 0 && invoice.amountPaid >= invoice.grandTotal) return 'paid';
  if (invoice.amountPaid > 0) return 'partially_paid';
  if (invoice.status === 'draft') return 'draft';
  if (now > invoice.dueDate) return 'overdue';
  return 'unpaid';
}

export function getInvoiceStatus(invoice: InvoiceStatusInput): Invoice['status'] {
  return resolveInvoiceStatus(invoice);
}

export function getInvoiceOutstandingAmount(invoice: Pick<Invoice, 'status' | 'grandTotal' | 'amountPaid' | 'dueDate'>): number {
  const status = getInvoiceStatus(invoice);
  if (status === 'draft' || status === 'cancelled') return 0;
  return roundMoney(Math.max(invoice.grandTotal - invoice.amountPaid, 0));
}

export function getInvoiceOverdueBalance(
  invoice: Pick<Invoice, 'status' | 'grandTotal' | 'amountPaid' | 'dueDate'>,
  now = Date.now(),
): number {
  const outstanding = getInvoiceOutstandingAmount(invoice);
  if (outstanding <= 0) return 0;
  return now > invoice.dueDate ? outstanding : 0;
}

export function getInvoiceEditLockReason(
  invoice: InvoiceStatusInput,
  hasPaymentHistory: boolean,
  hasReceiptHistory: boolean,
): string | null {
  if (getInvoiceStatus(invoice) === 'cancelled') {
    return 'Cancelled invoices are locked to preserve financial history.';
  }
  if (hasPaymentHistory || hasReceiptHistory || invoice.amountPaid > 0) {
    return 'Invoices with payment or receipt history are permanently locked for audit integrity. Reverse active transactions, then cancel and replace the invoice if a correction is required.';
  }
  return null;
}


export type QuotationStatusInput = Pick<Quotation, 'status' | 'expiryDate' | 'convertedInvoiceId'>;

export function resolveQuotationStatus(quotation: QuotationStatusInput, now = Date.now()): Quotation['status'] {
  if (quotation.convertedInvoiceId) return 'accepted';
  if (quotation.status === 'accepted' || quotation.status === 'rejected') return quotation.status;
  if (now > quotation.expiryDate) return 'expired';
  // Legacy data may have persisted `expired`. Once the expiry is extended,
  // treat it as sent again so the quotation can re-enter the normal workflow.
  return quotation.status === 'expired' ? 'sent' : quotation.status;
}

export function getQuotationStatus(quotation: QuotationStatusInput): Quotation['status'] {
  return resolveQuotationStatus(quotation);
}

export function getQuotationEditLockReason(quotation: QuotationStatusInput): string | null {
  if (quotation.convertedInvoiceId) return 'Converted quotations are locked because the invoice must preserve the accepted quote history.';
  if (quotation.status === 'accepted') return 'Accepted quotations are locked. Convert it to an invoice or create a replacement quotation if terms change.';
  if (quotation.status === 'rejected') return 'Rejected quotations are locked. Create a replacement quotation if the customer requests new terms.';
  return null;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-ZM', { month: 'short', day: 'numeric' });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function searchItems<T>(
  items: readonly T[],
  query: string,
  selectors: Array<(item: T) => string | number | null | undefined>,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];

  return items.filter((item) =>
    selectors.some((selector) => {
      const value = selector(item);
      return value != null && String(value).toLowerCase().includes(q);
    }),
  );
}


export function isPaymentReversed(payment: Pick<PaymentRecord, 'status'>): boolean {
  return payment.status === 'reversed';
}

export function isReceiptVoided(receipt: Pick<Receipt, 'status'>): boolean {
  return receipt.status === 'voided';
}

export function getPaymentMethodLabel(type: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    mtn_money: 'MTN Mobile Money',
    airtel_money: 'Airtel Money',
    zamtel_money: 'Zamtel Money',
    card: 'Card',
    cheque: 'Cheque',
    other: 'Other',
  };
  return labels[type] || type;
}
