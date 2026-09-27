import type {
  AppSettings,
  Business,
  Customer,
  Invoice,
  Item,
  Notification,
  PaymentMethod,
  PaymentRecord,
  Quotation,
  Receipt,
} from '../types';
import { normalizeAppSettings } from './settings';
import { calculateLineAmounts, calculateTotals, isSafeMoneyAmount, isValidTimestamp, roundMoney } from './helpers';

export const BACKUP_FORMAT = 'invoice-receipt-maker-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const PERSISTENCE_VERSION = 1;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export interface BackupData {
  business: Business | null;
  settings: AppSettings;
  paymentMethods: PaymentMethod[];
  customers: Customer[];
  items: Item[];
  invoices: Invoice[];
  receipts: Receipt[];
  quotations: Quotation[];
  payments: PaymentRecord[];
  notifications: Notification[];
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  persistenceVersion: typeof PERSISTENCE_VERSION;
  exportedAt: number;
  appVersion: string;
  checksum: string;
  data: BackupData;
}

export interface BackupSummary {
  businessName: string;
  currency: string;
  exportedAt: number;
  customers: number;
  items: number;
  invoices: number;
  quotations: number;
  payments: number;
  receipts: number;
}

export interface BackupParseResult {
  success: boolean;
  error?: string;
  envelope?: BackupEnvelope;
  summary?: BackupSummary;
}

export interface BackupDataValidationResult {
  success: boolean;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeFinite(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveTimestamp(value: unknown): value is number {
  return typeof value === 'number' && isValidTimestamp(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

// FNV-1a is used as an accidental-corruption checksum, not as a security signature.
export function computeBackupChecksum(data: BackupData): string {
  const text = stableStringify(data);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

function duplicateValue(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) return value;
    seen.add(normalized);
  }
  return null;
}

function validateLineItems(owner: string, items: unknown, allowBlankDraftRow = false): string | null {
  if (!Array.isArray(items)) return `${owner} items are invalid.`;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!isRecord(item)) return `${owner} item ${index + 1} is invalid.`;
    const blankDraftRow = allowBlankDraftRow
      && !stringValue(item.itemId).trim()
      && !stringValue(item.name).trim()
      && !stringValue(item.description).trim()
      && item.quantity === 1
      && item.unitPrice === 0
      && item.discount === 0
      && item.tax === 0;
    if (!stringValue(item.name).trim() && !blankDraftRow) return `${owner} item ${index + 1} has no name.`;
    if (!isFiniteNumber(item.quantity) || item.quantity <= 0 || item.quantity > Number.MAX_SAFE_INTEGER) return `${owner} item ${index + 1} has an invalid quantity.`;
    if (!isSafeMoneyAmount(item.unitPrice as number) || (item.unitPrice as number) < 0) return `${owner} item ${index + 1} has an invalid unit price.`;
    if (!isSafeMoneyAmount(item.discount as number) || (item.discount as number) < 0) return `${owner} item ${index + 1} has an invalid discount.`;
    if (!isFiniteNumber(item.tax) || item.tax < 0 || item.tax > 100) return `${owner} item ${index + 1} has an invalid tax rate.`;
    if (!isSafeMoneyAmount(item.amount as number) || (item.amount as number) < 0) return `${owner} item ${index + 1} has an invalid amount.`;
    const expectedLine = calculateLineAmounts({
      quantity: item.quantity,
      unitPrice: item.unitPrice as number,
      discount: item.discount as number,
      tax: item.tax,
      taxInclusive: Boolean(item.taxInclusive),
    }).lineTotal;
    if (!isSafeMoneyAmount(expectedLine) || Math.abs(expectedLine - (item.amount as number)) >= 0.01) return `${owner} item ${index + 1} amount does not match its quantity, price, discount and tax.`;
  }
  return null;
}

function validateCollectionIds(label: string, collection: unknown): string | null {
  if (!Array.isArray(collection)) return `${label} collection is missing or invalid.`;
  const ids: string[] = [];
  for (let index = 0; index < collection.length; index += 1) {
    const entry = collection[index];
    if (!isRecord(entry)) return `${label} record ${index + 1} is invalid.`;
    const id = stringValue(entry.id).trim();
    if (!id) return `${label} record ${index + 1} has no ID.`;
    ids.push(id);
  }
  const duplicate = duplicateValue(ids);
  return duplicate ? `${label} contains duplicate ID “${duplicate}”.` : null;
}

export function validateBackupData(value: unknown): BackupDataValidationResult {
  if (!isRecord(value)) return { success: false, error: 'Backup data is missing.' };

  for (const key of ['paymentMethods', 'customers', 'items', 'invoices', 'receipts', 'quotations', 'payments', 'notifications']) {
    const issue = validateCollectionIds(key, value[key]);
    if (issue) return { success: false, error: issue };
  }

  if (value.business !== null && !isRecord(value.business)) return { success: false, error: 'Business profile is invalid.' };
  const business = value.business === null ? null : value.business as Record<string, unknown>;
  if (business) {
    if (!stringValue(business.id).trim()) return { success: false, error: 'Business profile has no ID.' };
    if (!stringValue(business.name).trim()) return { success: false, error: 'Business profile has no name.' };
    if (!stringValue(business.currency).trim()) return { success: false, error: 'Business profile has no currency.' };
  }

  if (!isRecord(value.settings)) return { success: false, error: 'Settings are missing or invalid.' };
  const settings = normalizeAppSettings(value.settings);
  if (!settings.document.invoicePrefix || !settings.document.quotationPrefix || !settings.document.receiptPrefix) {
    return { success: false, error: 'Document settings are invalid.' };
  }

  const customers = value.customers as unknown[];
  const items = value.items as unknown[];
  const invoices = value.invoices as unknown[];
  const receipts = value.receipts as unknown[];
  const quotations = value.quotations as unknown[];
  const payments = value.payments as unknown[];
  const paymentMethods = value.paymentMethods as unknown[];
  const notifications = value.notifications as unknown[];

  const hasBusinessData = customers.length > 0 || items.length > 0 || invoices.length > 0 || receipts.length > 0 || quotations.length > 0 || payments.length > 0 || paymentMethods.length > 0;
  if (!business && hasBusinessData) return { success: false, error: 'Backup contains business data but no business profile.' };

  const customerIds = new Set(customers.map((entry) => stringValue((entry as Record<string, unknown>).id)));
  const itemIds = new Set(items.map((entry) => stringValue((entry as Record<string, unknown>).id)));
  const paymentMethodIds = new Set(paymentMethods.map((entry) => stringValue((entry as Record<string, unknown>).id)));
  const invoiceById = new Map(invoices.map((entry) => [stringValue((entry as Record<string, unknown>).id), entry as Record<string, unknown>]));
  const invoiceIds = new Set(invoiceById.keys());
  const paymentById = new Map(payments.map((entry) => [stringValue((entry as Record<string, unknown>).id), entry as Record<string, unknown>]));
  const paymentIds = new Set(paymentById.keys());
  const receiptById = new Map(receipts.map((entry) => [stringValue((entry as Record<string, unknown>).id), entry as Record<string, unknown>]));

  const invoiceNumberDuplicate = duplicateValue(invoices.map((entry) => stringValue((entry as Record<string, unknown>).number)));
  if (invoiceNumberDuplicate) return { success: false, error: `Invoices contain duplicate number “${invoiceNumberDuplicate}”.` };
  const quotationNumberDuplicate = duplicateValue(quotations.map((entry) => stringValue((entry as Record<string, unknown>).number)));
  if (quotationNumberDuplicate) return { success: false, error: `Quotations contain duplicate number “${quotationNumberDuplicate}”.` };
  const receiptNumberDuplicate = duplicateValue(receipts.map((entry) => stringValue((entry as Record<string, unknown>).number)));
  if (receiptNumberDuplicate) return { success: false, error: `Receipts contain duplicate number “${receiptNumberDuplicate}”.` };

  const customerPhoneDuplicate = duplicateValue(customers.map((entry) => stringValue((entry as Record<string, unknown>).phone)));
  if (customerPhoneDuplicate) return { success: false, error: `Customers contain duplicate phone “${customerPhoneDuplicate}”.` };
  const customerEmailDuplicate = duplicateValue(customers.map((entry) => stringValue((entry as Record<string, unknown>).email)));
  if (customerEmailDuplicate) return { success: false, error: `Customers contain duplicate email “${customerEmailDuplicate}”.` };
  const itemSkuDuplicate = duplicateValue(items.map((entry) => stringValue((entry as Record<string, unknown>).sku)));
  if (itemSkuDuplicate) return { success: false, error: `Items contain duplicate SKU “${itemSkuDuplicate}”.` };
  const itemBarcodeDuplicate = duplicateValue(items.map((entry) => stringValue((entry as Record<string, unknown>).barcode)));
  if (itemBarcodeDuplicate) return { success: false, error: `Items contain duplicate barcode “${itemBarcodeDuplicate}”.` };

  for (const entry of customers) {
    const customer = entry as Record<string, unknown>;
    if (customer.type !== 'individual' && customer.type !== 'business') return { success: false, error: 'A customer has an invalid type.' };
    if (!stringValue(customer.name).trim()) return { success: false, error: 'A customer has no name.' };
    if (!isSafeMoneyAmount(customer.outstandingBalance as number) || (customer.outstandingBalance as number) < 0) return { success: false, error: `Customer “${stringValue(customer.name)}” has an invalid outstanding balance.` };
    if (!isPositiveTimestamp(customer.createdAt)) return { success: false, error: `Customer “${stringValue(customer.name)}” has an invalid created date.` };
  }

  for (const entry of items) {
    const item = entry as Record<string, unknown>;
    if (item.type !== 'product' && item.type !== 'service') return { success: false, error: 'An item has an invalid type.' };
    if (!stringValue(item.name).trim()) return { success: false, error: 'An item has no name.' };
    for (const field of ['price', 'costPrice']) {
      if (!isSafeMoneyAmount(item[field] as number) || (item[field] as number) < 0) return { success: false, error: `Item “${stringValue(item.name)}” has invalid ${field}.` };
    }
    if (!isNonNegativeFinite(item.stockQuantity) || (item.stockQuantity as number) > Number.MAX_SAFE_INTEGER) return { success: false, error: `Item “${stringValue(item.name)}” has invalid stockQuantity.` };
    if (!isFiniteNumber(item.tax) || (item.tax as number) < 0 || (item.tax as number) > 100) return { success: false, error: `Item “${stringValue(item.name)}” has an invalid tax rate.` };
    const itemCurrency = stringValue(item.currency).trim().toUpperCase();
    if (!itemCurrency) return { success: false, error: `Item “${stringValue(item.name)}” has no currency.` };
    if (business && itemCurrency !== stringValue(business.currency).trim().toUpperCase()) return { success: false, error: `Item “${stringValue(item.name)}” currency does not match the business currency.` };
    if (!isPositiveTimestamp(item.createdAt)) return { success: false, error: `Item “${stringValue(item.name)}” has an invalid created date.` };
  }

  for (const entry of invoices) {
    const invoice = entry as Record<string, unknown>;
    const number = stringValue(invoice.number).trim();
    if (!number) return { success: false, error: 'An invoice has no number.' };
    if (!['draft', 'unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled'].includes(stringValue(invoice.status))) return { success: false, error: `Invoice ${number} has an invalid status.` };
    const customerId = stringValue(invoice.customerId).trim();
    if (customerId && !customerIds.has(customerId)) return { success: false, error: `Invoice ${number} references a missing customer.` };
    const itemIssue = validateLineItems(`Invoice ${number}`, invoice.items, invoice.status === 'draft');
    if (itemIssue) return { success: false, error: itemIssue };
    for (const line of invoice.items as unknown[]) {
      const lineItemId = stringValue((line as Record<string, unknown>).itemId).trim();
      if (lineItemId && !itemIds.has(lineItemId)) return { success: false, error: `Invoice ${number} references missing item ${lineItemId}.` };
    }
    if (!Array.isArray(invoice.paymentMethods) || invoice.paymentMethods.some((id) => typeof id !== 'string')) return { success: false, error: `Invoice ${number} has invalid payment-method references.` };
    const selectedPaymentMethodIds = (invoice.paymentMethods as string[]).map((id) => id.trim()).filter(Boolean);
    if (duplicateValue(selectedPaymentMethodIds)) return { success: false, error: `Invoice ${number} contains duplicate payment-method references.` };
    for (const paymentMethodId of selectedPaymentMethodIds) {
      if (!paymentMethodIds.has(paymentMethodId)) return { success: false, error: `Invoice ${number} references missing payment method ${paymentMethodId}.` };
    }
    if (invoice.status !== 'draft' && !customerId) return { success: false, error: `Invoice ${number} has no customer.` };
    if (invoice.status !== 'draft' && (!Array.isArray(invoice.items) || invoice.items.length === 0)) return { success: false, error: `Invoice ${number} has no line items.` };
    for (const field of ['subtotal', 'discount', 'tax', 'shipping', 'grandTotal', 'amountPaid', 'balanceDue']) {
      if (!isSafeMoneyAmount(invoice[field] as number) || (invoice[field] as number) < 0) return { success: false, error: `Invoice ${number} has invalid ${field}.` };
    }
    const invoiceTotals = calculateTotals(invoice.items as Parameters<typeof calculateTotals>[0]);
    if (![invoiceTotals.subtotal, invoiceTotals.totalDiscount, invoiceTotals.totalTax, invoiceTotals.itemsTotal].every(isSafeMoneyAmount)) return { success: false, error: `Invoice ${number} totals exceed the safe monetary range.` };
    if (Math.abs(invoiceTotals.subtotal - (invoice.subtotal as number)) >= 0.01) return { success: false, error: `Invoice ${number} subtotal does not match its line items.` };
    if (Math.abs(invoiceTotals.totalTax - (invoice.tax as number)) >= 0.01) return { success: false, error: `Invoice ${number} tax does not match its line items.` };
    if ((invoice.discount as number) > invoiceTotals.itemsTotal + 0.01) return { success: false, error: `Invoice ${number} document discount exceeds its items total.` };
    const expectedGrandTotal = roundMoney(Math.max(invoiceTotals.itemsTotal - (invoice.discount as number) + (invoice.shipping as number), 0));
    if (Math.abs(expectedGrandTotal - (invoice.grandTotal as number)) >= 0.01) return { success: false, error: `Invoice ${number} total does not match its line items.` };
    if (invoice.status !== 'draft' && (invoice.grandTotal as number) <= 0) return { success: false, error: `Invoice ${number} must have a positive total once issued.` };
    if ((invoice.amountPaid as number) > (invoice.grandTotal as number) + 0.01) return { success: false, error: `Invoice ${number} is overpaid beyond its stored total.` };
    const expectedBalance = invoice.status === 'cancelled' ? 0 : roundMoney(Math.max((invoice.grandTotal as number) - (invoice.amountPaid as number), 0));
    if (Math.abs(expectedBalance - (invoice.balanceDue as number)) >= 0.01) return { success: false, error: `Invoice ${number} balance does not match its total and payment history.` };
    if (!isPositiveTimestamp(invoice.issueDate) || !isPositiveTimestamp(invoice.dueDate) || !isPositiveTimestamp(invoice.createdAt) || !isPositiveTimestamp(invoice.updatedAt)) {
      return { success: false, error: `Invoice ${number} has an invalid date.` };
    }
    if ((invoice.dueDate as number) < (invoice.issueDate as number)) return { success: false, error: `Invoice ${number} is due before its issue date.` };
    if (invoice.status === 'cancelled' && !isPositiveTimestamp(invoice.cancelledAt)) return { success: false, error: `Cancelled invoice ${number} is missing its cancellation timestamp.` };
    if (invoice.status === 'cancelled' && (invoice.cancelledAt as number) < Math.max(invoice.issueDate as number, invoice.createdAt as number)) return { success: false, error: `Cancelled invoice ${number} has a cancellation timestamp before its financial record existed.` };
    if (invoice.status !== 'cancelled' && invoice.cancelledAt !== undefined) return { success: false, error: `Invoice ${number} has a cancellation timestamp but is not Cancelled.` };
  }

  for (const entry of quotations) {
    const quotation = entry as Record<string, unknown>;
    const number = stringValue(quotation.number).trim();
    if (!number) return { success: false, error: 'A quotation has no number.' };
    if (!['draft', 'sent', 'accepted', 'rejected', 'expired'].includes(stringValue(quotation.status))) return { success: false, error: `Quotation ${number} has an invalid status.` };
    if (!isPositiveTimestamp(quotation.issueDate) || !isPositiveTimestamp(quotation.expiryDate) || !isPositiveTimestamp(quotation.createdAt) || !isPositiveTimestamp(quotation.updatedAt)) return { success: false, error: `Quotation ${number} has an invalid date.` };
    if ((quotation.expiryDate as number) < (quotation.issueDate as number)) return { success: false, error: `Quotation ${number} expires before its issue date.` };
    const customerId = stringValue(quotation.customerId).trim();
    if (customerId && !customerIds.has(customerId)) return { success: false, error: `Quotation ${number} references a missing customer.` };
    const itemIssue = validateLineItems(`Quotation ${number}`, quotation.items, quotation.status === 'draft');
    if (itemIssue) return { success: false, error: itemIssue };
    for (const line of quotation.items as unknown[]) {
      const lineItemId = stringValue((line as Record<string, unknown>).itemId).trim();
      if (lineItemId && !itemIds.has(lineItemId)) return { success: false, error: `Quotation ${number} references missing item ${lineItemId}.` };
    }
    if (quotation.status !== 'draft' && !customerId) return { success: false, error: `Quotation ${number} has no customer.` };
    if (quotation.status !== 'draft' && (!Array.isArray(quotation.items) || quotation.items.length === 0)) return { success: false, error: `Quotation ${number} has no line items.` };
    for (const field of ['subtotal', 'discount', 'tax', 'total']) {
      if (!isSafeMoneyAmount(quotation[field] as number) || (quotation[field] as number) < 0) return { success: false, error: `Quotation ${number} has invalid ${field}.` };
    }
    const quotationTotals = calculateTotals(quotation.items as Parameters<typeof calculateTotals>[0]);
    if (![quotationTotals.subtotal, quotationTotals.totalDiscount, quotationTotals.totalTax, quotationTotals.itemsTotal].every(isSafeMoneyAmount)) return { success: false, error: `Quotation ${number} totals exceed the safe monetary range.` };
    if (Math.abs(quotationTotals.subtotal - (quotation.subtotal as number)) >= 0.01) return { success: false, error: `Quotation ${number} subtotal does not match its line items.` };
    if (Math.abs(quotationTotals.totalTax - (quotation.tax as number)) >= 0.01) return { success: false, error: `Quotation ${number} tax does not match its line items.` };
    if ((quotation.discount as number) > quotationTotals.itemsTotal + 0.01) return { success: false, error: `Quotation ${number} document discount exceeds its items total.` };
    const expectedQuotationTotal = roundMoney(Math.max(quotationTotals.itemsTotal - (quotation.discount as number), 0));
    if (Math.abs(expectedQuotationTotal - (quotation.total as number)) >= 0.01) return { success: false, error: `Quotation ${number} total does not match its line items.` };
    if (quotation.status !== 'draft' && (quotation.total as number) <= 0) return { success: false, error: `Quotation ${number} must have a positive total once customer-facing.` };
    const convertedInvoiceId = stringValue(quotation.convertedInvoiceId).trim();
    if (convertedInvoiceId && !invoiceIds.has(convertedInvoiceId)) return { success: false, error: `Quotation ${number} references a missing converted invoice.` };
    if (convertedInvoiceId && quotation.status !== 'accepted') return { success: false, error: `Quotation ${number} is linked to a converted invoice but is not Accepted.` };
    if (convertedInvoiceId && !isPositiveTimestamp(quotation.convertedAt)) return { success: false, error: `Quotation ${number} is missing its conversion timestamp.` };
    if (convertedInvoiceId && (quotation.convertedAt as number) < Math.max(quotation.issueDate as number, quotation.createdAt as number)) return { success: false, error: `Quotation ${number} has a conversion timestamp before the quotation existed.` };
    if (!convertedInvoiceId && quotation.convertedAt !== undefined) return { success: false, error: `Quotation ${number} has a conversion timestamp but no converted invoice.` };
    if (convertedInvoiceId) {
      const convertedInvoice = invoiceById.get(convertedInvoiceId)!;
      if (stringValue(convertedInvoice.customerId).trim() !== customerId) return { success: false, error: `Quotation ${number} customer does not match its converted invoice.` };
      if (stringValue(convertedInvoice.referenceNumber).trim() !== number) return { success: false, error: `Quotation ${number} converted invoice does not preserve the quotation reference.` };
      if (Math.abs((convertedInvoice.grandTotal as number) - (quotation.total as number)) >= 0.01) return { success: false, error: `Quotation ${number} total does not match its converted invoice.` };
    }
  }

  const activePaymentTotals = new Map<string, number>();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const latestTransactionDate = endOfToday.getTime();
  for (const entry of payments) {
    const payment = entry as Record<string, unknown>;
    const id = stringValue(payment.id);
    if (payment.status !== undefined && payment.status !== 'active' && payment.status !== 'reversed') return { success: false, error: `Payment ${id} has an invalid status.` };
    if (!isSafeMoneyAmount(payment.amount as number) || (payment.amount as number) <= 0) return { success: false, error: `Payment ${id} has an invalid amount.` };
    if (payment.status === 'reversed' && (!isPositiveTimestamp(payment.reversedAt) || !stringValue(payment.reversalReason).trim())) return { success: false, error: `Reversed payment ${id} is missing reversal audit data.` };
    if (!isPositiveTimestamp(payment.date) || !isPositiveTimestamp(payment.createdAt)) return { success: false, error: `Payment ${id} has an invalid date.` };
    if ((payment.date as number) > latestTransactionDate) return { success: false, error: `Payment ${id} is dated in the future.` };
    if (payment.status === 'reversed' && (payment.reversedAt as number) < (payment.createdAt as number)) return { success: false, error: `Reversed payment ${id} has a reversal timestamp before the payment record existed.` };
    const invoiceId = stringValue(payment.invoiceId).trim();
    if (invoiceId && !invoiceIds.has(invoiceId)) return { success: false, error: `Payment ${id} references a missing invoice.` };
    const customerId = stringValue(payment.customerId).trim();
    if (customerId && !customerIds.has(customerId)) return { success: false, error: `Payment ${id} references a missing customer.` };
    const linkedInvoice = invoiceId ? invoiceById.get(invoiceId) : undefined;
    if (linkedInvoice && stringValue(linkedInvoice.customerId).trim() !== customerId) return { success: false, error: `Payment ${id} customer does not match its linked invoice.` };
    if (linkedInvoice && (payment.date as number) < (linkedInvoice.issueDate as number)) return { success: false, error: `Payment ${id} predates its linked invoice.` };
    if (linkedInvoice && linkedInvoice.status === 'draft') return { success: false, error: `Payment ${id} is linked to a Draft invoice.` };
    const receiptId = stringValue(payment.receiptId).trim();
    if (receiptId && !receiptById.has(receiptId)) return { success: false, error: `Payment ${id} references a missing receipt.` };
    if (invoiceId && payment.status !== 'reversed') {
      const nextPaymentTotal = (activePaymentTotals.get(invoiceId) ?? 0) + (payment.amount as number);
      if (!isSafeMoneyAmount(nextPaymentTotal)) return { success: false, error: `Payment history for invoice ${invoiceId} exceeds the safe monetary range.` };
      activePaymentTotals.set(invoiceId, nextPaymentTotal);
    }
  }

  for (const entry of invoices) {
    const invoice = entry as Record<string, unknown>;
    const invoiceId = stringValue(invoice.id);
    const number = stringValue(invoice.number);
    const expected = Math.round((activePaymentTotals.get(invoiceId) ?? 0) * 100) / 100;
    const stored = Math.round((invoice.amountPaid as number) * 100) / 100;
    if (Math.abs(expected - stored) >= 0.01) return { success: false, error: `Invoice ${number} payment total does not match active payment history.` };
  }

  const receiptPaymentLinks = new Map<string, string>();
  for (const entry of receipts) {
    const receipt = entry as Record<string, unknown>;
    const number = stringValue(receipt.number).trim();
    if (!number) return { success: false, error: 'A receipt has no number.' };
    if (receipt.status !== undefined && receipt.status !== 'active' && receipt.status !== 'voided') return { success: false, error: `Receipt ${number} has an invalid status.` };
    if (receipt.status === 'voided' && (!isPositiveTimestamp(receipt.voidedAt) || !stringValue(receipt.voidReason).trim())) return { success: false, error: `Voided receipt ${number} is missing void audit data.` };
    if (!isSafeMoneyAmount(receipt.amountReceived as number) || (receipt.amountReceived as number) <= 0) return { success: false, error: `Receipt ${number} has an invalid amount.` };
    if (!isPositiveTimestamp(receipt.date) || !isPositiveTimestamp(receipt.createdAt)) return { success: false, error: `Receipt ${number} has an invalid date.` };
    if ((receipt.date as number) > latestTransactionDate) return { success: false, error: `Receipt ${number} is dated in the future.` };
    if (receipt.status === 'voided' && (receipt.voidedAt as number) < (receipt.createdAt as number)) return { success: false, error: `Voided receipt ${number} has a void timestamp before the receipt record existed.` };
    const invoiceId = stringValue(receipt.linkedInvoiceId).trim();
    if (invoiceId && !invoiceIds.has(invoiceId)) return { success: false, error: `Receipt ${number} references a missing invoice.` };
    const customerId = stringValue(receipt.customerId).trim();
    if (customerId && !customerIds.has(customerId)) return { success: false, error: `Receipt ${number} references a missing customer.` };
    const paymentId = stringValue(receipt.paymentId).trim();
    if (paymentId && !paymentIds.has(paymentId)) return { success: false, error: `Receipt ${number} references a missing payment.` };
    if (paymentId) {
      const priorReceiptId = receiptPaymentLinks.get(paymentId);
      const receiptId = stringValue(receipt.id).trim();
      if (priorReceiptId && priorReceiptId !== receiptId) return { success: false, error: `Payment ${paymentId} is linked to more than one receipt.` };
      receiptPaymentLinks.set(paymentId, receiptId);
    }

    const linkedInvoice = invoiceId ? invoiceById.get(invoiceId) : undefined;
    if (linkedInvoice && stringValue(linkedInvoice.customerId).trim() !== customerId) {
      return { success: false, error: `Receipt ${number} customer does not match its linked invoice.` };
    }
    if (linkedInvoice && (receipt.date as number) < (linkedInvoice.issueDate as number)) return { success: false, error: `Receipt ${number} predates its linked invoice.` };

    const linkedPayment = paymentId ? paymentById.get(paymentId) : undefined;
    if (linkedPayment) {
      const paymentReceiptId = stringValue(linkedPayment.receiptId).trim();
      if (paymentReceiptId && paymentReceiptId !== stringValue(receipt.id).trim()) {
        return { success: false, error: `Receipt ${number} and payment ${paymentId} do not reference each other.` };
      }
      if (Math.abs((linkedPayment.amount as number) - (receipt.amountReceived as number)) >= 0.01) {
        return { success: false, error: `Receipt ${number} amount does not match its linked payment.` };
      }
      if (stringValue(linkedPayment.invoiceId).trim() !== invoiceId) {
        return { success: false, error: `Receipt ${number} invoice does not match its linked payment.` };
      }
      if (stringValue(linkedPayment.customerId).trim() !== customerId) {
        return { success: false, error: `Receipt ${number} customer does not match its linked payment.` };
      }
      const paymentReversed = linkedPayment.status === 'reversed';
      const receiptVoided = receipt.status === 'voided';
      if (paymentReversed !== receiptVoided) {
        return { success: false, error: `Receipt ${number} status does not match its linked payment audit state.` };
      }
    }
  }

  const receiptLinks = new Map<string, string>();
  for (const entry of payments) {
    const payment = entry as Record<string, unknown>;
    const paymentId = stringValue(payment.id).trim();
    const receiptId = stringValue(payment.receiptId).trim();
    if (!receiptId) continue;
    const receipt = receiptById.get(receiptId);
    if (!receipt) continue;
    const reciprocalPaymentId = stringValue(receipt.paymentId).trim();
    if (reciprocalPaymentId && reciprocalPaymentId !== paymentId) {
      return { success: false, error: `Payment ${paymentId} and receipt ${stringValue(receipt.number)} do not reference each other.` };
    }
    const priorPaymentId = receiptLinks.get(receiptId);
    if (priorPaymentId && priorPaymentId !== paymentId) {
      return { success: false, error: `Receipt ${stringValue(receipt.number)} is linked to more than one payment.` };
    }
    receiptLinks.set(receiptId, paymentId);
    if (Math.abs((payment.amount as number) - (receipt.amountReceived as number)) >= 0.01) {
      return { success: false, error: `Payment ${paymentId} amount does not match receipt ${stringValue(receipt.number)}.` };
    }
    if (stringValue(payment.invoiceId).trim() !== stringValue(receipt.linkedInvoiceId).trim()) {
      return { success: false, error: `Payment ${paymentId} invoice does not match receipt ${stringValue(receipt.number)}.` };
    }
    if (stringValue(payment.customerId).trim() !== stringValue(receipt.customerId).trim()) {
      return { success: false, error: `Payment ${paymentId} customer does not match receipt ${stringValue(receipt.number)}.` };
    }
    const paymentReversed = payment.status === 'reversed';
    const receiptVoided = receipt.status === 'voided';
    if (paymentReversed !== receiptVoided) {
      return { success: false, error: `Payment ${paymentId} audit state does not match receipt ${stringValue(receipt.number)}.` };
    }
  }

  for (const entry of invoices) {
    const invoice = entry as Record<string, unknown>;
    if (invoice.status !== 'cancelled') continue;
    const invoiceId = stringValue(invoice.id).trim();
    if ((activePaymentTotals.get(invoiceId) ?? 0) > 0) return { success: false, error: `Cancelled invoice ${stringValue(invoice.number)} has active payment history.` };
    const hasActiveReceipt = receipts.some((entry) => {
      const receipt = entry as Record<string, unknown>;
      return stringValue(receipt.linkedInvoiceId).trim() === invoiceId && receipt.status !== 'voided';
    });
    if (hasActiveReceipt) return { success: false, error: `Cancelled invoice ${stringValue(invoice.number)} has an active receipt.` };
  }

  const bankMethodKeys = new Set<string>();
  const mobileMethodKeys = new Set<string>();
  for (const entry of paymentMethods) {
    const method = entry as Record<string, unknown>;
    const type = stringValue(method.type);
    if (!['cash', 'bank_transfer', 'mtn_money', 'airtel_money', 'zamtel_money', 'card', 'cheque', 'other'].includes(type)) return { success: false, error: 'A payment method has an invalid type.' };
    const businessId = stringValue(method.businessId).trim();
    if (business && businessId !== stringValue(business.id).trim()) {
      return { success: false, error: 'A payment method belongs to a different or missing business profile.' };
    }
    if (type === 'bank_transfer' && (!stringValue(method.bankName).trim() || !stringValue(method.accountNumber).trim())) {
      return { success: false, error: 'A bank-transfer payment method is missing bank or account details.' };
    }
    if (type === 'bank_transfer') {
      const key = `${stringValue(method.bankName).trim().toLowerCase()}::${stringValue(method.accountNumber).trim().toLowerCase()}`;
      if (bankMethodKeys.has(key)) return { success: false, error: 'Payment methods contain duplicate bank-transfer details.' };
      bankMethodKeys.add(key);
    }
    if (['mtn_money', 'airtel_money', 'zamtel_money'].includes(type) && !stringValue(method.phoneNumber).trim()) {
      return { success: false, error: 'A mobile-money payment method is missing its phone number.' };
    }
    if (['mtn_money', 'airtel_money', 'zamtel_money'].includes(type)) {
      const key = `${type}::${stringValue(method.phoneNumber).trim().toLowerCase()}`;
      if (mobileMethodKeys.has(key)) return { success: false, error: 'Payment methods contain duplicate mobile-money details.' };
      mobileMethodKeys.add(key);
    }
  }

  for (const entry of notifications) {
    const notification = entry as Record<string, unknown>;
    if (!stringValue(notification.title).trim()) return { success: false, error: 'A notification has no title.' };
    if (!isPositiveTimestamp(notification.date)) return { success: false, error: 'A notification has an invalid date.' };
    if (typeof notification.read !== 'boolean') return { success: false, error: 'A notification has an invalid read state.' };
  }

  return { success: true };
}

export function createBackupEnvelope(data: BackupData, appVersion = '0.0.0', exportedAt = Date.now()): BackupEnvelope {
  const safeData: BackupData = JSON.parse(JSON.stringify({
    ...data,
    settings: normalizeAppSettings(data.settings),
  })) as BackupData;
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    persistenceVersion: PERSISTENCE_VERSION,
    exportedAt,
    appVersion,
    checksum: computeBackupChecksum(safeData),
    data: safeData,
  };
}

export function summarizeBackup(envelope: BackupEnvelope): BackupSummary {
  return {
    businessName: envelope.data.business?.name?.trim() || 'No business profile',
    currency: envelope.data.business?.currency?.trim() || '—',
    exportedAt: envelope.exportedAt,
    customers: envelope.data.customers.length,
    items: envelope.data.items.length,
    invoices: envelope.data.invoices.length,
    quotations: envelope.data.quotations.length,
    payments: envelope.data.payments.length,
    receipts: envelope.data.receipts.length,
  };
}

export function parseBackupText(text: string): BackupParseResult {
  if (!text.trim()) return { success: false, error: 'Backup file is empty.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: 'Backup file is not valid JSON.' };
  }
  if (!isRecord(parsed)) return { success: false, error: 'Backup file has an invalid root object.' };
  if (parsed.format !== BACKUP_FORMAT) return { success: false, error: 'This file is not an Invoice & Receipt Maker backup.' };
  if (parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) return { success: false, error: `Unsupported backup schema version ${String(parsed.schemaVersion)}.` };
  if (parsed.persistenceVersion !== PERSISTENCE_VERSION) return { success: false, error: `Unsupported persistence version ${String(parsed.persistenceVersion)}.` };
  if (!isPositiveTimestamp(parsed.exportedAt)) return { success: false, error: 'Backup export date is invalid.' };
  if (typeof parsed.checksum !== 'string') return { success: false, error: 'Backup checksum is missing.' };
  const validation = validateBackupData(parsed.data);
  if (!validation.success) return validation;
  const data = parsed.data as unknown as BackupData;
  if (computeBackupChecksum(data) !== parsed.checksum) return { success: false, error: 'Backup checksum does not match. The file may be incomplete or modified.' };
  const envelope = parsed as unknown as BackupEnvelope;
  return { success: true, envelope, summary: summarizeBackup(envelope) };
}

export async function readBackupFile(file: File): Promise<BackupParseResult> {
  if (file.size > MAX_BACKUP_BYTES) return { success: false, error: 'Backup file exceeds the 25 MB safety limit.' };
  try {
    return parseBackupText(await file.text());
  } catch {
    return { success: false, error: 'Unable to read the selected backup file.' };
  }
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'business';
}

export function backupFilename(businessName: string, exportedAt = Date.now()): string {
  const date = new Date(exportedAt).toISOString().slice(0, 10);
  return `${safeFilenamePart(businessName)}-invoice-maker-backup-${date}.json`;
}

export function downloadBackupFile(envelope: BackupEnvelope, businessName: string): void {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backupFilename(businessName, envelope.exportedAt);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
