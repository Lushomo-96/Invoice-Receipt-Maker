import type { Customer, Invoice, PaymentRecord, Quotation, Receipt } from '../types';
import {
  getInvoiceOutstandingAmount,
  getInvoiceOverdueBalance,
  getInvoiceStatus,
  resolveQuotationStatus,
  isPaymentReversed,
  isReceiptVoided,
  roundMoney,
} from './helpers';

export type DashboardPeriod = 'This Week' | 'This Month' | 'This Quarter' | 'This Year' | 'All Time';

export interface DateRange {
  start: number;
  end: number;
}

type InvoiceMetricInput = Pick<Invoice, 'id' | 'number' | 'customerName' | 'grandTotal' | 'amountPaid' | 'issueDate' | 'dueDate' | 'status'>;
type PaymentMetricInput = Pick<PaymentRecord, 'amount' | 'date' | 'status'>;
type ReceiptMetricInput = Pick<Receipt, 'id' | 'number' | 'customerName' | 'receivedFrom' | 'amountReceived' | 'date' | 'status'>;
type QuotationMetricInput = Pick<Quotation, 'id' | 'number' | 'customerName' | 'total' | 'issueDate' | 'expiryDate' | 'status' | 'convertedInvoiceId'>;
type CustomerMetricInput = Pick<Customer, 'createdAt'>;

export interface DashboardMetrics {
  sales: number;
  paid: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
  customerCount: number;
  receiptCount: number;
  quotationCount: number;
}

export interface DashboardDocument {
  id: string;
  type: 'Invoice' | 'Receipt' | 'Quotation';
  number: string;
  customer: string;
  amount: number;
  date: number;
  status: string;
  path: string;
  isOverdue?: boolean;
}

function startOfLocalDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function shiftMonthKeepingProgress(date: Date, months: number): Date {
  const source = new Date(date);
  const day = source.getDate();
  const shifted = new Date(source.getFullYear(), source.getMonth() + months, 1, source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, lastDay));
  return shifted;
}

function startOfWeek(date: Date): number {
  const d = new Date(date);
  const day = d.getDay();
  const daysSinceMonday = (day + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return startOfLocalDay(d);
}

function startOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function startOfQuarter(date: Date): number {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterMonth, 1).getTime();
}

function startOfYear(date: Date): number {
  return new Date(date.getFullYear(), 0, 1).getTime();
}

export function getDashboardPeriodRange(period: DashboardPeriod, now = Date.now()): DateRange {
  const current = new Date(now);
  switch (period) {
    case 'This Week':
      return { start: startOfWeek(current), end: now };
    case 'This Month':
      return { start: startOfMonth(current), end: now };
    case 'This Quarter':
      return { start: startOfQuarter(current), end: now };
    case 'This Year':
      return { start: startOfYear(current), end: now };
    case 'All Time':
      return { start: Number.NEGATIVE_INFINITY, end: now };
  }
}

export function getPreviousDashboardPeriodRange(period: DashboardPeriod, now = Date.now()): DateRange | null {
  const current = new Date(now);
  switch (period) {
    case 'This Week': {
      const end = new Date(now);
      end.setDate(end.getDate() - 7);
      const start = new Date(getDashboardPeriodRange(period, now).start);
      start.setDate(start.getDate() - 7);
      return { start: start.getTime(), end: end.getTime() };
    }
    case 'This Month': {
      const end = shiftMonthKeepingProgress(current, -1);
      return { start: new Date(end.getFullYear(), end.getMonth(), 1).getTime(), end: end.getTime() };
    }
    case 'This Quarter': {
      const end = shiftMonthKeepingProgress(current, -3);
      const quarterMonth = Math.floor(end.getMonth() / 3) * 3;
      return { start: new Date(end.getFullYear(), quarterMonth, 1).getTime(), end: end.getTime() };
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

export function isWithinRange(timestamp: number, range: DateRange): boolean {
  return timestamp >= range.start && timestamp <= range.end;
}

export function calculateDashboardMetrics(
  invoices: readonly InvoiceMetricInput[],
  payments: readonly PaymentMetricInput[],
  receipts: readonly ReceiptMetricInput[],
  quotations: readonly QuotationMetricInput[],
  customers: readonly CustomerMetricInput[],
  range: DateRange,
  now = Date.now(),
): DashboardMetrics {
  const periodInvoices = invoices.filter((invoice) => isWithinRange(invoice.issueDate, range));

  const sales = periodInvoices.reduce((sum, invoice) => {
    const status = getInvoiceStatus(invoice);
    return status === 'draft' || status === 'cancelled' ? sum : sum + invoice.grandTotal;
  }, 0);

  const paid = payments.reduce((sum, payment) => {
    if (isPaymentReversed(payment) || !isWithinRange(payment.date, range)) return sum;
    return sum + payment.amount;
  }, 0);

  const outstanding = periodInvoices.reduce((sum, invoice) => sum + getInvoiceOutstandingAmount(invoice), 0);
  const overdue = periodInvoices.reduce((sum, invoice) => sum + getInvoiceOverdueBalance(invoice, now), 0);

  return {
    sales: roundMoney(sales),
    paid: roundMoney(paid),
    outstanding: roundMoney(outstanding),
    overdue: roundMoney(overdue),
    invoiceCount: periodInvoices.length,
    customerCount: customers.filter((customer) => isWithinRange(customer.createdAt, range)).length,
    receiptCount: receipts.filter((receipt) => !isReceiptVoided(receipt) && isWithinRange(receipt.date, range)).length,
    quotationCount: quotations.filter((quotation) => isWithinRange(quotation.issueDate, range)).length,
  };
}

export function buildDashboardDocuments(
  invoices: readonly InvoiceMetricInput[],
  receipts: readonly ReceiptMetricInput[],
  quotations: readonly QuotationMetricInput[],
  range: DateRange,
  now = Date.now(),
): DashboardDocument[] {
  const invoiceDocuments: DashboardDocument[] = invoices
    .filter((invoice) => isWithinRange(invoice.issueDate, range))
    .map((invoice) => ({
      id: invoice.id,
      type: 'Invoice',
      number: invoice.number,
      customer: invoice.customerName,
      amount: invoice.grandTotal,
      date: invoice.issueDate,
      status: getInvoiceStatus(invoice),
      path: `/invoices/${invoice.id}`,
      isOverdue: getInvoiceOverdueBalance(invoice, now) > 0,
    }));

  const receiptDocuments: DashboardDocument[] = receipts
    .filter((receipt) => isWithinRange(receipt.date, range))
    .map((receipt) => ({
      id: receipt.id,
      type: 'Receipt',
      number: receipt.number,
      customer: receipt.customerName || receipt.receivedFrom,
      amount: receipt.amountReceived,
      date: receipt.date,
      status: isReceiptVoided(receipt) ? 'voided' : 'paid',
      path: `/receipts/${receipt.id}`,
    }));

  const quotationDocuments: DashboardDocument[] = quotations
    .filter((quotation) => isWithinRange(quotation.issueDate, range))
    .map((quotation) => ({
      id: quotation.id,
      type: 'Quotation',
      number: quotation.number,
      customer: quotation.customerName,
      amount: quotation.total,
      date: quotation.issueDate,
      status: resolveQuotationStatus(quotation, now),
      path: `/quotations/${quotation.id}`,
    }));

  return [...invoiceDocuments, ...receiptDocuments, ...quotationDocuments].sort((a, b) => b.date - a.date);
}

export function calculatePeriodChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
