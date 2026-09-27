import type { Invoice } from '../types';
import {
  getInvoiceOutstandingAmount,
  getInvoiceOverdueBalance,
  getInvoiceStatus,
  getPaymentMethodLabel,
  isReceiptVoided,
  roundMoney,
} from './helpers';


type ReportInvoice = Pick<Invoice, 'id' | 'customerId' | 'customerName' | 'grandTotal' | 'amountPaid' | 'issueDate' | 'dueDate' | 'status' | 'updatedAt' | 'cancelledAt'>;
type ReportPayment = {
  customerId: string;
  customerName: string;
  amount: number;
  date: number;
  method: string;
  status?: 'active' | 'reversed';
  reversedAt?: number;
};
type ReportReceipt = { date: number; status?: 'active' | 'voided'; voidedAt?: number };
type ReportQuotation = { issueDate: number };
type ReportCustomer = { id: string; name: string; createdAt: number };

export type ReportPeriod = 'Today' | 'This Week' | 'This Month' | 'This Quarter' | 'This Year' | 'All Time';

export interface ReportDateRange {
  start: number;
  end: number;
}

export interface ReportMetrics {
  sales: number;
  cancellationAdjustments: number;
  netInvoiced: number;
  grossCollections: number;
  reversals: number;
  netCash: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
  receiptCount: number;
  voidedReceiptCount: number;
  quotationCount: number;
  newCustomerCount: number;
  averageInvoiceValue: number;
}

export interface CustomerReportRow {
  customerId: string;
  customerName: string;
  sales: number;
  invoiceCount: number;
  grossCollections: number;
  reversals: number;
  netCash: number;
  outstanding: number;
}

export interface PaymentMethodReportRow {
  method: string;
  label: string;
  grossCollections: number;
  reversals: number;
  netCash: number;
  transactionCount: number;
}

export interface AgingBucket {
  key: 'not_due' | '1_30' | '31_60' | '61_90' | '90_plus';
  label: string;
  amount: number;
  invoiceCount: number;
}

export interface InvoiceStatusReportRow {
  status: Invoice['status'];
  count: number;
  amount: number;
}

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function startOfWeek(date: Date): number {
  const d = new Date(date);
  const day = d.getDay();
  const daysSinceMonday = (day + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return startOfDay(d);
}

function startOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function startOfQuarter(date: Date): number {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1).getTime();
}

function startOfYear(date: Date): number {
  return new Date(date.getFullYear(), 0, 1).getTime();
}

function shiftMonthKeepingProgress(date: Date, months: number): Date {
  const source = new Date(date);
  const day = source.getDate();
  const shifted = new Date(source.getFullYear(), source.getMonth() + months, 1, source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, lastDay));
  return shifted;
}

export function getReportPeriodRange(period: ReportPeriod, now = Date.now()): ReportDateRange {
  const current = new Date(now);
  // The end boundary uses end-of-day rather than the precise current instant. Recorded
  // dates (payments, receipts) are normalized to a fixed time-of-day (e.g. noon) rather
  // than the moment of entry, so comparing against `now` could exclude same-day records
  // entered before that fixed time (e.g. a noon-stamped payment recorded at 10am).
  const end = endOfDay(current);
  switch (period) {
    case 'Today':
      return { start: startOfDay(current), end };
    case 'This Week':
      return { start: startOfWeek(current), end };
    case 'This Month':
      return { start: startOfMonth(current), end };
    case 'This Quarter':
      return { start: startOfQuarter(current), end };
    case 'This Year':
      return { start: startOfYear(current), end };
    case 'All Time':
      return { start: Number.NEGATIVE_INFINITY, end };
  }
}

export function getPreviousReportPeriodRange(period: ReportPeriod, now = Date.now()): ReportDateRange | null {
  const current = new Date(now);
  switch (period) {
    case 'Today': {
      const previous = new Date(current);
      previous.setDate(previous.getDate() - 1);
      const elapsed = now - startOfDay(current);
      const start = startOfDay(previous);
      return { start, end: start + elapsed };
    }
    case 'This Week': {
      const elapsed = now - startOfWeek(current);
      const currentStart = new Date(startOfWeek(current));
      currentStart.setDate(currentStart.getDate() - 7);
      return { start: currentStart.getTime(), end: currentStart.getTime() + elapsed };
    }
    case 'This Month': {
      const end = shiftMonthKeepingProgress(current, -1);
      return { start: new Date(end.getFullYear(), end.getMonth(), 1).getTime(), end: end.getTime() };
    }
    case 'This Quarter': {
      const end = shiftMonthKeepingProgress(current, -3);
      return { start: new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1).getTime(), end: end.getTime() };
    }
    case 'This Year': {
      const end = new Date(current);
      end.setFullYear(end.getFullYear() - 1);
      return { start: new Date(end.getFullYear(), 0, 1).getTime(), end: end.getTime() };
    }
    case 'All Time':
      return null;
  }
}

export function isWithinReportRange(timestamp: number, range: ReportDateRange): boolean {
  return timestamp >= range.start && timestamp <= range.end;
}

function wasIssued(invoice: ReportInvoice): boolean {
  return invoice.status !== 'draft';
}

export function getInvoiceCancellationTimestamp(invoice: ReportInvoice): number | undefined {
  if (invoice.status !== 'cancelled') return undefined;
  const timestamp = typeof invoice.cancelledAt === 'number' && Number.isFinite(invoice.cancelledAt)
    ? invoice.cancelledAt
    : Number.isFinite(invoice.updatedAt)
      ? invoice.updatedAt
      : undefined;
  return timestamp !== undefined && timestamp >= invoice.issueDate ? timestamp : undefined;
}

export function calculateReportMetrics(
  invoices: readonly ReportInvoice[],
  payments: readonly ReportPayment[],
  receipts: readonly ReportReceipt[],
  quotations: readonly ReportQuotation[],
  customers: readonly ReportCustomer[],
  range: ReportDateRange,
  now = Date.now(),
): ReportMetrics {
  const periodInvoices = invoices.filter((invoice) => isWithinReportRange(invoice.issueDate, range));
  const issuedInvoices = periodInvoices.filter(wasIssued);
  const grossCollections = payments.reduce((sum, payment) => (
    isWithinReportRange(payment.date, range) ? sum + payment.amount : sum
  ), 0);
  const reversals = payments.reduce((sum, payment) => (
    payment.status === 'reversed' && payment.reversedAt && isWithinReportRange(payment.reversedAt, range)
      ? sum + payment.amount
      : sum
  ), 0);
  const sales = issuedInvoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
  const cancellationAdjustments = invoices.reduce((sum, invoice) => {
    const cancelledAt = getInvoiceCancellationTimestamp(invoice);
    return cancelledAt !== undefined && isWithinReportRange(cancelledAt, range)
      ? sum + invoice.grandTotal
      : sum;
  }, 0);
  const outstanding = issuedInvoices.reduce((sum, invoice) => sum + getInvoiceOutstandingAmount(invoice), 0);
  const overdue = issuedInvoices.reduce((sum, invoice) => sum + getInvoiceOverdueBalance(invoice, now), 0);
  const receiptCount = receipts.filter((receipt) => !isReceiptVoided(receipt) && isWithinReportRange(receipt.date, range)).length;
  const voidedReceiptCount = receipts.filter((receipt) => receipt.status === 'voided' && Boolean(receipt.voidedAt) && isWithinReportRange(receipt.voidedAt!, range)).length;
  const quotationCount = quotations.filter((quotation) => isWithinReportRange(quotation.issueDate, range)).length;
  const newCustomerCount = customers.filter((customer) => isWithinReportRange(customer.createdAt, range)).length;

  return {
    sales: roundMoney(sales),
    cancellationAdjustments: roundMoney(cancellationAdjustments),
    netInvoiced: roundMoney(sales - cancellationAdjustments),
    grossCollections: roundMoney(grossCollections),
    reversals: roundMoney(reversals),
    netCash: roundMoney(grossCollections - reversals),
    outstanding: roundMoney(outstanding),
    overdue: roundMoney(overdue),
    invoiceCount: issuedInvoices.length,
    receiptCount,
    voidedReceiptCount,
    quotationCount,
    newCustomerCount,
    averageInvoiceValue: issuedInvoices.length ? roundMoney(sales / issuedInvoices.length) : 0,
  };
}

export function calculateReportChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function buildTopCustomers(
  customers: readonly ReportCustomer[],
  invoices: readonly ReportInvoice[],
  payments: readonly ReportPayment[],
  range: ReportDateRange,
  limit = 5,
): CustomerReportRow[] {
  const rows = new Map<string, CustomerReportRow>();
  for (const customer of customers) {
    rows.set(customer.id, {
      customerId: customer.id,
      customerName: customer.name,
      sales: 0,
      invoiceCount: 0,
      grossCollections: 0,
      reversals: 0,
      netCash: 0,
      outstanding: 0,
    });
  }

  const ensureRow = (customerId: string, customerName: string): CustomerReportRow => {
    const existing = rows.get(customerId);
    if (existing) return existing;
    const row: CustomerReportRow = {
      customerId,
      customerName: customerName || 'Historical customer',
      sales: 0,
      invoiceCount: 0,
      grossCollections: 0,
      reversals: 0,
      netCash: 0,
      outstanding: 0,
    };
    rows.set(customerId, row);
    return row;
  };

  for (const invoice of invoices) {
    if (!isWithinReportRange(invoice.issueDate, range) || !wasIssued(invoice)) continue;
    const row = ensureRow(invoice.customerId, invoice.customerName);
    row.sales = roundMoney(row.sales + invoice.grandTotal);
    row.invoiceCount += 1;
    row.outstanding = roundMoney(row.outstanding + getInvoiceOutstandingAmount(invoice));
  }

  for (const payment of payments) {
    const row = ensureRow(payment.customerId, payment.customerName);
    if (isWithinReportRange(payment.date, range)) {
      row.grossCollections = roundMoney(row.grossCollections + payment.amount);
    }
    if (payment.status === 'reversed' && payment.reversedAt && isWithinReportRange(payment.reversedAt, range)) {
      row.reversals = roundMoney(row.reversals + payment.amount);
    }
  }

  for (const row of rows.values()) {
    row.netCash = roundMoney(row.grossCollections - row.reversals);
  }

  return [...rows.values()]
    .filter((row) => row.sales !== 0 || row.grossCollections !== 0 || row.reversals !== 0 || row.outstanding !== 0)
    .sort((a, b) => b.sales - a.sales || b.netCash - a.netCash || a.customerName.localeCompare(b.customerName))
    .slice(0, limit);
}

export function buildPaymentMethodBreakdown(
  payments: readonly ReportPayment[],
  range: ReportDateRange,
): PaymentMethodReportRow[] {
  const rows = new Map<string, PaymentMethodReportRow>();
  const getRow = (method: string) => {
    const existing = rows.get(method);
    if (existing) return existing;
    const row: PaymentMethodReportRow = {
      method,
      label: getPaymentMethodLabel(method),
      grossCollections: 0,
      reversals: 0,
      netCash: 0,
      transactionCount: 0,
    };
    rows.set(method, row);
    return row;
  };

  for (const payment of payments) {
    const row = getRow(payment.method);
    if (isWithinReportRange(payment.date, range)) {
      row.grossCollections = roundMoney(row.grossCollections + payment.amount);
      row.transactionCount += 1;
    }
    if (payment.status === 'reversed' && payment.reversedAt && isWithinReportRange(payment.reversedAt, range)) {
      row.reversals = roundMoney(row.reversals + payment.amount);
    }
  }

  for (const row of rows.values()) {
    row.netCash = roundMoney(row.grossCollections - row.reversals);
  }

  return [...rows.values()]
    .filter((row) => row.grossCollections !== 0 || row.reversals !== 0)
    .sort((a, b) => b.netCash - a.netCash || b.grossCollections - a.grossCollections);
}

export function buildReceivablesAging(invoices: readonly ReportInvoice[], now = Date.now()): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { key: 'not_due', label: 'Not due', amount: 0, invoiceCount: 0 },
    { key: '1_30', label: '1–30 days', amount: 0, invoiceCount: 0 },
    { key: '31_60', label: '31–60 days', amount: 0, invoiceCount: 0 },
    { key: '61_90', label: '61–90 days', amount: 0, invoiceCount: 0 },
    { key: '90_plus', label: '90+ days', amount: 0, invoiceCount: 0 },
  ];
  const dayMs = 24 * 60 * 60 * 1000;

  for (const invoice of invoices) {
    const amount = getInvoiceOutstandingAmount(invoice);
    if (amount <= 0) continue;
    const bucket = now <= invoice.dueDate
      ? buckets[0]
      : (() => {
          const daysOverdue = Math.max(1, Math.ceil((now - invoice.dueDate) / dayMs));
          return daysOverdue <= 30
            ? buckets[1]
            : daysOverdue <= 60
              ? buckets[2]
              : daysOverdue <= 90
                ? buckets[3]
                : buckets[4];
        })();
    bucket.amount = roundMoney(bucket.amount + amount);
    bucket.invoiceCount += 1;
  }

  return buckets;
}

export function buildInvoiceStatusBreakdown(invoices: readonly ReportInvoice[], range: ReportDateRange): InvoiceStatusReportRow[] {
  const order: Invoice['status'][] = ['paid', 'partially_paid', 'unpaid', 'overdue', 'draft', 'cancelled'];
  const map = new Map<Invoice['status'], InvoiceStatusReportRow>();
  for (const status of order) map.set(status, { status, count: 0, amount: 0 });

  for (const invoice of invoices) {
    if (!isWithinReportRange(invoice.issueDate, range)) continue;
    const status = getInvoiceStatus(invoice);
    const row = map.get(status)!;
    row.count += 1;
    row.amount = roundMoney(row.amount + invoice.grandTotal);
  }

  return order.map((status) => map.get(status)!).filter((row) => row.count > 0);
}
