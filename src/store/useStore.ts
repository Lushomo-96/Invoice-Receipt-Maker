import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';
import React from 'react';
import type { AppSettings, Business, Customer, Item, Invoice, Receipt, Quotation, PaymentRecord, PaymentMethod, Notification } from '../types';
import { calculateTotals, generateDocumentNumber, generateId, getInvoiceEditLockReason, getInvoiceStatus, getQuotationEditLockReason, getQuotationStatus, isPaymentReversed, isReceiptVoided, isSafeMoneyAmount, isValidTimestamp, recalculateInvoiceItem, resolveInvoiceStatus, roundMoney } from '../utils/helpers';
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, paymentTermDays } from '../utils/settings';
import { PERSISTENCE_VERSION, validateBackupData, type BackupData } from '../utils/backup';

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer U)[] ? ReadonlyArray<DeepReadonly<U>>
      : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;

function deepFreezeClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => deepFreezeClone(entry))) as T;
  }
  if (value !== null && typeof value === 'object') {
    const clone = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, deepFreezeClone(entry)]),
    );
    return Object.freeze(clone) as T;
  }
  return value;
}

function sealAppSettings(settings: AppSettings): AppSettings {
  return deepFreezeClone(normalizeAppSettings(settings));
}

function businessText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBusinessRecord(business: Business): Business {
  return {
    ...business,
    id: businessText(business.id),
    name: businessText(business.name),
    type: businessText(business.type),
    tpin: businessText(business.tpin),
    registrationNumber: businessText(business.registrationNumber),
    phone: businessText(business.phone),
    email: businessText(business.email),
    website: businessText(business.website),
    addressLine1: businessText(business.addressLine1),
    addressLine2: businessText(business.addressLine2),
    townCity: businessText(business.townCity),
    country: businessText(business.country),
    currency: businessText(business.currency).toUpperCase(),
    slogan: businessText(business.slogan),
    taxRegNumber: businessText(business.taxRegNumber),
    additionalIdentifier: businessText(business.additionalIdentifier),
    logo: typeof business.logo === 'string' ? business.logo : '',
  };
}

function sealBusinessRecord(business: Business): Business {
  return deepFreezeClone(normalizeBusinessRecord(business));
}

function sealFinancialRecord<T extends Invoice | PaymentRecord | Receipt>(record: T): T {
  return deepFreezeClone(record);
}

function sealFinancialCollection<T extends Invoice | PaymentRecord | Receipt>(records: readonly T[]): T[] {
  return deepFreezeClone([...records]);
}

function sealQuotationRecord(record: Quotation): Quotation {
  return deepFreezeClone(record);
}

function sealQuotationCollection(records: readonly Quotation[]): Quotation[] {
  return deepFreezeClone([...records]);
}

function sealMasterRecord<T extends Customer | Item>(record: T): T {
  return deepFreezeClone(record);
}

function sealMasterCollection<T extends Customer | Item>(records: readonly T[]): T[] {
  return deepFreezeClone([...records]);
}

function sealPaymentMethodCollection(records: readonly PaymentMethod[]): PaymentMethod[] {
  return deepFreezeClone([...records]);
}

function sealNotificationCollection(records: readonly Notification[]): Notification[] {
  return deepFreezeClone([...records]);
}

export interface RecordPaymentInput {
  invoiceId?: string;
  customerId?: string;
  customerName?: string;
  amount: number;
  date: number;
  method: string;
  referenceNumber?: string;
  notes?: string;
  createReceipt?: boolean;
}

export interface RecordPaymentResult {
  success: boolean;
  error?: string;
  payment?: DeepReadonly<PaymentRecord>;
  receipt?: DeepReadonly<Receipt>;
  invoice?: DeepReadonly<Invoice>;
}

export interface InvoiceMutationResult {
  success: boolean;
  error?: string;
  invoice?: DeepReadonly<Invoice>;
}

export interface CustomerMutationResult {
  success: boolean;
  error?: string;
  customer?: DeepReadonly<Customer>;
}

export interface PaymentMethodMutationResult {
  success: boolean;
  error?: string;
  paymentMethod?: DeepReadonly<PaymentMethod>;
}

export interface ReversePaymentInput {
  paymentId: string;
  reason: string;
  notes?: string;
}

export interface ReversePaymentResult {
  success: boolean;
  error?: string;
  payment?: DeepReadonly<PaymentRecord>;
  receipt?: DeepReadonly<Receipt>;
  invoice?: DeepReadonly<Invoice>;
}

export interface VoidReceiptInput {
  receiptId: string;
  reason: string;
}

export interface VoidReceiptResult {
  success: boolean;
  error?: string;
  receipt?: DeepReadonly<Receipt>;
}

export interface QuotationMutationResult {
  success: boolean;
  error?: string;
  quotation?: DeepReadonly<Quotation>;
}

export interface ConvertQuotationResult extends QuotationMutationResult {
  invoice?: DeepReadonly<Invoice>;
}

interface PreparedInvoiceResult {
  success: boolean;
  error?: string;
  invoice?: Invoice;
}

function prepareInvoiceForStorage(invoice: Invoice, requireComplete: boolean): PreparedInvoiceResult {
  if (!invoice.id.trim()) return { success: false, error: 'Invoice ID is required.' };
  if (!invoice.number.trim()) return { success: false, error: 'Invoice number is required.' };
  if (!isValidTimestamp(invoice.issueDate)) {
    return { success: false, error: 'Invoice issue date is invalid.' };
  }
  if (!isValidTimestamp(invoice.dueDate)) {
    return { success: false, error: 'Invoice due date is invalid.' };
  }
  if (invoice.dueDate < invoice.issueDate) {
    return { success: false, error: 'Invoice due date cannot be earlier than its issue date.' };
  }
  if (!isSafeMoneyAmount(invoice.discount) || invoice.discount < 0) {
    return { success: false, error: 'Invoice discount must be a valid non-negative money amount.' };
  }
  if (!isSafeMoneyAmount(invoice.shipping) || invoice.shipping < 0) {
    return { success: false, error: 'Shipping must be a valid non-negative money amount.' };
  }
  if (requireComplete && (!invoice.customerId.trim() || !invoice.customerName.trim())) {
    return { success: false, error: 'Invoice requires a customer.' };
  }
  if (requireComplete && invoice.items.length === 0) {
    return { success: false, error: 'Invoice requires at least one item.' };
  }

  const items: Invoice['items'] = [];
  for (let index = 0; index < invoice.items.length; index += 1) {
    const item = invoice.items[index];
    const label = `Item ${index + 1}`;
    const hasEnteredData = Boolean(
      item.itemId
      || item.name.trim()
      || item.description.trim()
      || item.unitPrice !== 0
      || item.discount !== 0
      || item.tax !== 0
      || item.quantity !== 1,
    );

    if (!requireComplete && !hasEnteredData) {
      items.push(recalculateInvoiceItem({ ...item, taxInclusive: item.taxInclusive ?? false }));
      continue;
    }
    if (!item.name.trim()) return { success: false, error: `${label} needs a name.` };
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > Number.MAX_SAFE_INTEGER) {
      return { success: false, error: `${label} quantity must be greater than 0 and within the safe numeric range.` };
    }
    if (!isSafeMoneyAmount(item.unitPrice) || item.unitPrice < 0) {
      return { success: false, error: `${label} unit price must be a valid non-negative money amount.` };
    }
    if (!isSafeMoneyAmount(item.discount) || item.discount < 0) {
      return { success: false, error: `${label} discount must be a valid non-negative money amount.` };
    }
    const grossAmount = roundMoney(item.quantity * item.unitPrice);
    if (!isSafeMoneyAmount(grossAmount)) {
      return { success: false, error: `${label} amount is too large to calculate safely.` };
    }
    if (item.discount > grossAmount) {
      return { success: false, error: `${label} discount cannot exceed its line subtotal.` };
    }
    if (!Number.isFinite(item.tax) || item.tax < 0 || item.tax > 100) {
      return { success: false, error: `${label} tax must be between 0% and 100%.` };
    }
    items.push(recalculateInvoiceItem({ ...item, taxInclusive: item.taxInclusive ?? false }));
  }

  const totals = calculateTotals(items);
  if (![totals.subtotal, totals.totalDiscount, totals.totalTax, totals.itemsTotal].every(isSafeMoneyAmount)) {
    return { success: false, error: 'Invoice totals are too large to calculate safely.' };
  }
  const discount = roundMoney(invoice.discount);
  const shipping = roundMoney(invoice.shipping);
  if (discount > totals.itemsTotal) {
    return { success: false, error: 'Invoice discount cannot exceed the items total.' };
  }
  const grandTotal = roundMoney(Math.max(totals.itemsTotal - discount + shipping, 0));
  if (!isSafeMoneyAmount(grandTotal)) return { success: false, error: 'Invoice total is too large to calculate safely.' };
  if (requireComplete && grandTotal <= 0) {
    return { success: false, error: 'Invoice total must be greater than 0.' };
  }

  return {
    success: true,
    invoice: {
      ...invoice,
      id: invoice.id.trim(),
      number: invoice.number.trim(),
      customerId: invoice.customerId.trim(),
      customerName: invoice.customerName.trim(),
      customerPhone: invoice.customerPhone.trim(),
      customerAddress: invoice.customerAddress.trim(),
      customerTpin: invoice.customerTpin.trim(),
      items,
      subtotal: totals.subtotal,
      discount,
      tax: totals.totalTax,
      shipping,
      grandTotal,
      referenceNumber: invoice.referenceNumber.trim(),
      purchaseOrderNumber: invoice.purchaseOrderNumber.trim(),
      paymentTerms: invoice.paymentTerms.trim(),
      paymentMethods: [...invoice.paymentMethods],
      notes: invoice.notes.trim(),
      terms: invoice.terms.trim(),
      attachment: invoice.attachment.trim(),
    },
  };
}

interface PreparedQuotationResult {
  success: boolean;
  error?: string;
  quotation?: Quotation;
}

function prepareQuotationForStorage(quotation: Quotation, requireComplete: boolean): PreparedQuotationResult {
  if (!quotation.id.trim()) return { success: false, error: 'Quotation ID is required.' };
  if (!quotation.number.trim()) return { success: false, error: 'Quotation number is required.' };
  if (!isValidTimestamp(quotation.issueDate)) {
    return { success: false, error: 'Quotation issue date is invalid.' };
  }
  if (!isValidTimestamp(quotation.expiryDate)) {
    return { success: false, error: 'Quotation expiry date is invalid.' };
  }
  if (quotation.expiryDate < quotation.issueDate) {
    return { success: false, error: 'Quotation expiry date cannot be earlier than its issue date.' };
  }
  if (!isSafeMoneyAmount(quotation.discount) || quotation.discount < 0) {
    return { success: false, error: 'Quotation discount must be a valid non-negative money amount.' };
  }
  if (requireComplete && (!quotation.customerId.trim() || !quotation.customerName.trim())) {
    return { success: false, error: 'Quotation requires a customer.' };
  }
  if (requireComplete && quotation.items.length === 0) {
    return { success: false, error: 'Quotation requires at least one item.' };
  }

  const items: Quotation['items'] = [];
  for (let index = 0; index < quotation.items.length; index += 1) {
    const item = quotation.items[index];
    const label = `Item ${index + 1}`;
    const hasEnteredData = Boolean(
      item.itemId
      || item.name.trim()
      || item.description.trim()
      || item.unitPrice !== 0
      || item.discount !== 0
      || item.tax !== 0
      || item.quantity !== 1,
    );

    if (!requireComplete && !hasEnteredData) {
      items.push(recalculateInvoiceItem({ ...item, taxInclusive: item.taxInclusive ?? false }));
      continue;
    }
    if (!item.name.trim()) return { success: false, error: `${label} needs a name.` };
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > Number.MAX_SAFE_INTEGER) {
      return { success: false, error: `${label} quantity must be greater than 0 and within the safe numeric range.` };
    }
    if (!isSafeMoneyAmount(item.unitPrice) || item.unitPrice < 0) {
      return { success: false, error: `${label} unit price must be a valid non-negative money amount.` };
    }
    if (!isSafeMoneyAmount(item.discount) || item.discount < 0) {
      return { success: false, error: `${label} discount must be a valid non-negative money amount.` };
    }
    const grossAmount = roundMoney(item.quantity * item.unitPrice);
    if (!isSafeMoneyAmount(grossAmount)) {
      return { success: false, error: `${label} amount is too large to calculate safely.` };
    }
    if (item.discount > grossAmount) {
      return { success: false, error: `${label} discount cannot exceed its line subtotal.` };
    }
    if (!Number.isFinite(item.tax) || item.tax < 0 || item.tax > 100) {
      return { success: false, error: `${label} tax must be between 0% and 100%.` };
    }
    items.push(recalculateInvoiceItem({ ...item, taxInclusive: item.taxInclusive ?? false }));
  }

  const totals = calculateTotals(items);
  if (![totals.subtotal, totals.totalDiscount, totals.totalTax, totals.itemsTotal].every(isSafeMoneyAmount)) {
    return { success: false, error: 'Quotation totals are too large to calculate safely.' };
  }
  const discount = roundMoney(quotation.discount);
  if (discount > totals.itemsTotal) {
    return { success: false, error: 'Quotation discount cannot exceed the items total.' };
  }
  const total = roundMoney(Math.max(totals.itemsTotal - discount, 0));
  if (!isSafeMoneyAmount(total)) return { success: false, error: 'Quotation total is too large to calculate safely.' };
  if (requireComplete && total <= 0) {
    return { success: false, error: 'Quotation total must be greater than 0.' };
  }

  return {
    success: true,
    quotation: {
      ...quotation,
      customerId: quotation.customerId.trim(),
      customerName: quotation.customerName.trim(),
      customerPhone: quotation.customerPhone?.trim(),
      customerAddress: quotation.customerAddress?.trim(),
      customerTpin: quotation.customerTpin?.trim(),
      items,
      subtotal: totals.subtotal,
      discount,
      tax: totals.totalTax,
      total,
      notes: quotation.notes.trim(),
      terms: quotation.terms.trim(),
    },
  };
}

function quotationDerivedValuesMatch(original: Quotation, prepared: Quotation): boolean {
  const moneyMatches = (left: number, right: number) => isSafeMoneyAmount(left) && isSafeMoneyAmount(right) && Math.abs(left - right) < 0.01;
  if (!moneyMatches(original.subtotal, prepared.subtotal)) return false;
  if (!moneyMatches(original.discount, prepared.discount)) return false;
  if (!moneyMatches(original.tax, prepared.tax)) return false;
  if (!moneyMatches(original.total, prepared.total)) return false;
  if (original.items.length !== prepared.items.length) return false;
  return original.items.every((item, index) => moneyMatches(item.amount, prepared.items[index].amount));
}

function quotationRevisionInputsMatch(original: Quotation, prepared: Quotation): boolean {
  const normalizeText = (value?: string) => value?.trim() ?? '';
  if (normalizeText(original.customerId) !== normalizeText(prepared.customerId)) return false;
  if (normalizeText(original.customerName) !== normalizeText(prepared.customerName)) return false;
  if (normalizeText(original.customerPhone) !== normalizeText(prepared.customerPhone)) return false;
  if (normalizeText(original.customerAddress) !== normalizeText(prepared.customerAddress)) return false;
  if (normalizeText(original.customerTpin) !== normalizeText(prepared.customerTpin)) return false;
  if (original.issueDate !== prepared.issueDate) return false;
  if (original.expiryDate !== prepared.expiryDate) return false;
  if (roundMoney(original.discount) !== roundMoney(prepared.discount)) return false;
  if (normalizeText(original.notes) !== normalizeText(prepared.notes)) return false;
  if (normalizeText(original.terms) !== normalizeText(prepared.terms)) return false;
  if (original.items.length !== prepared.items.length) return false;

  return original.items.every((item, index) => {
    const next = prepared.items[index];
    return item.itemId === next.itemId
      && normalizeText(item.name) === normalizeText(next.name)
      && normalizeText(item.description) === normalizeText(next.description)
      && item.quantity === next.quantity
      && roundMoney(item.unitPrice) === roundMoney(next.unitPrice)
      && roundMoney(item.discount) === roundMoney(next.discount)
      && item.tax === next.tax
      && Boolean(item.taxInclusive) === Boolean(next.taxInclusive);
  });
}

function recalculateCustomerBalances(customers: Customer[], invoices: Invoice[]): Customer[] {
  return sealMasterCollection(customers.map((customer) => {
    const outstandingBalance = roundMoney(
      invoices
        .filter((invoice) => invoice.customerId === customer.id)
        .filter((invoice) => !['draft', 'cancelled'].includes(getInvoiceStatus(invoice)))
        .reduce((sum, invoice) => sum + Math.max(invoice.grandTotal - invoice.amountPaid, 0), 0),
    );
    return customer.outstandingBalance === outstandingBalance
      ? customer
      : { ...customer, outstandingBalance };
  }));
}

function validatePaymentReceiptRelationship(payment: PaymentRecord, receipt: Receipt | undefined): string | null {
  if (payment.receiptId && !receipt) return 'The payment references a missing receipt. Reconcile the audit trail before continuing.';
  if (!receipt) return null;
  if (receipt.paymentId && receipt.paymentId !== payment.id) return 'The linked receipt points to a different payment. Reconcile the audit trail before continuing.';
  if (payment.receiptId && receipt.id !== payment.receiptId) return 'The payment and receipt do not reference each other. Reconcile the audit trail before continuing.';
  if (!isSafeMoneyAmount(payment.amount) || !isSafeMoneyAmount(receipt.amountReceived) || Math.abs(payment.amount - receipt.amountReceived) >= 0.01) {
    return 'The linked receipt amount does not match the payment. Reconcile the audit trail before continuing.';
  }
  if (receipt.linkedInvoiceId !== payment.invoiceId) return 'The linked receipt invoice does not match the payment. Reconcile the audit trail before continuing.';
  if (receipt.customerId !== payment.customerId) return 'The linked receipt customer does not match the payment. Reconcile the audit trail before continuing.';
  if (isPaymentReversed(payment) !== isReceiptVoided(receipt)) return 'The payment and receipt audit states do not match. Reconcile the audit trail before continuing.';
  return null;
}

export interface ItemMutationResult {
  success: boolean;
  error?: string;
  item?: DeepReadonly<Item>;
}

function prepareItemForStorage(item: Item, business: Business | null, createdAt: number): ItemMutationResult {
  const id = item.id.trim();
  const name = item.name.trim();
  const currency = item.currency.trim().toUpperCase();
  if (!id) return { success: false, error: 'Item ID is required.' };
  if (!name) return { success: false, error: 'Item name is required.' };
  if (item.type !== 'product' && item.type !== 'service') return { success: false, error: 'Item type is invalid.' };
  if (!isSafeMoneyAmount(item.price) || item.price < 0) return { success: false, error: 'Item price must be a valid non-negative money amount.' };
  if (!isSafeMoneyAmount(item.costPrice) || item.costPrice < 0) return { success: false, error: 'Item cost price must be a valid non-negative money amount.' };
  if (!Number.isFinite(item.tax) || item.tax < 0 || item.tax > 100) return { success: false, error: 'Item tax must be between 0% and 100%.' };
  if (!Number.isFinite(item.stockQuantity) || item.stockQuantity < 0 || item.stockQuantity > Number.MAX_SAFE_INTEGER) return { success: false, error: 'Stock quantity must be non-negative and within the safe numeric range.' };
  if (!currency) return { success: false, error: 'Item currency is required.' };
  if (business && currency !== business.currency) return { success: false, error: `Item currency must match the business currency (${business.currency}).` };
  const prepared = sealMasterRecord<Item>({
    ...item,
    id,
    name,
    description: item.description.trim(),
    sku: item.sku.trim(),
    unit: item.unit.trim(),
    currency,
    barcode: item.barcode.trim(),
    price: roundMoney(item.price),
    costPrice: roundMoney(item.costPrice),
    createdAt,
  });
  return { success: true, item: prepared };
}

export interface BusinessMutationResult {
  success: boolean;
  error?: string;
  business?: DeepReadonly<Business> | null;
}

export interface BackupRestoreResult {
  success: boolean;
  error?: string;
}

function normalizedKey(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function prepareCustomerForStorage(
  customer: Customer,
  id: string,
  createdAt: number,
  outstandingBalance: number,
): CustomerMutationResult {
  const name = customer.name.trim();
  if (!id.trim()) return { success: false, error: 'Customer ID is required.' };
  if (customer.type !== 'individual' && customer.type !== 'business') return { success: false, error: 'Customer type is invalid.' };
  if (!name) return { success: false, error: 'Customer name is required.' };
  if (!isValidTimestamp(createdAt)) return { success: false, error: 'Customer creation timestamp is invalid.' };
  if (!isSafeMoneyAmount(outstandingBalance) || outstandingBalance < 0) return { success: false, error: 'Customer outstanding balance is invalid.' };

  const prepared = sealMasterRecord<Customer>({
    ...customer,
    id: id.trim(),
    name,
    businessName: customer.businessName.trim(),
    phone: customer.phone.trim(),
    email: customer.email.trim(),
    tpin: customer.tpin.trim(),
    address: customer.address.trim(),
    townCity: customer.townCity.trim(),
    country: customer.country.trim(),
    notes: customer.notes.trim(),
    createdAt,
    outstandingBalance: roundMoney(outstandingBalance),
  });
  return { success: true, customer: prepared };
}

const PAYMENT_METHOD_TYPES: readonly PaymentMethod['type'][] = ['cash', 'bank_transfer', 'mtn_money', 'airtel_money', 'zamtel_money', 'card', 'cheque', 'other'];

function preparePaymentMethodForStorage(method: PaymentMethod, business: Business | null, id: string): PaymentMethodMutationResult {
  if (!business) return { success: false, error: 'Set up a business profile before adding payment methods.' };
  if (!id.trim()) return { success: false, error: 'Payment method ID is required.' };
  if (!PAYMENT_METHOD_TYPES.includes(method.type)) return { success: false, error: 'Payment method type is invalid.' };

  const prepared: PaymentMethod = {
    ...method,
    id: id.trim(),
    businessId: business.id,
    provider: method.provider?.trim(),
    phoneNumber: method.phoneNumber?.trim(),
    accountName: method.accountName?.trim(),
    bankName: method.bankName?.trim(),
    accountNumber: method.accountNumber?.trim(),
    branch: method.branch?.trim(),
    swiftCode: method.swiftCode?.trim(),
  };

  if (method.type === 'cash') {
    prepared.provider = '';
    prepared.phoneNumber = '';
    prepared.accountName = '';
    prepared.bankName = '';
    prepared.accountNumber = '';
    prepared.branch = '';
    prepared.swiftCode = '';
  } else if (method.type === 'bank_transfer') {
    prepared.phoneNumber = '';
  } else if (['mtn_money', 'airtel_money', 'zamtel_money'].includes(method.type)) {
    prepared.bankName = '';
    prepared.accountNumber = '';
    prepared.branch = '';
    prepared.swiftCode = '';
  } else {
    prepared.phoneNumber = '';
    prepared.bankName = '';
    prepared.accountNumber = '';
    prepared.branch = '';
    prepared.swiftCode = '';
  }

  if (method.type === 'bank_transfer' && (!prepared.bankName || !prepared.accountNumber)) {
    return { success: false, error: 'Bank transfer details require a bank name and account number.' };
  }
  if (['mtn_money', 'airtel_money', 'zamtel_money'].includes(method.type) && !prepared.phoneNumber) {
    return { success: false, error: 'Mobile money payment methods require a phone number.' };
  }

  return { success: true, paymentMethod: deepFreezeClone(prepared) };
}

interface AppState {
  isAuthenticated: boolean;
  setAuthenticated: (v: boolean) => void;
  business: Business | null;
  setBusiness: (b: Business | null) => BusinessMutationResult;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  getBackupData: () => BackupData;
  restoreBackup: (data: BackupData) => BackupRestoreResult;
  paymentMethods: PaymentMethod[];
  addPaymentMethod: (pm: PaymentMethod) => PaymentMethodMutationResult;
  updatePaymentMethod: (pm: PaymentMethod) => PaymentMethodMutationResult;
  deletePaymentMethod: (id: string) => PaymentMethodMutationResult;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  showFabMenu: boolean;
  setShowFabMenu: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;
  customers: Customer[];
  addCustomer: (c: Customer) => CustomerMutationResult;
  updateCustomer: (c: Customer) => CustomerMutationResult;
  deleteCustomer: (id: string) => CustomerMutationResult;
  items: Item[];
  addItem: (i: Item) => ItemMutationResult;
  updateItem: (i: Item) => ItemMutationResult;
  deleteItem: (id: string) => ItemMutationResult;
  invoices: Invoice[];
  addInvoice: (i: Invoice) => InvoiceMutationResult;
  updateInvoice: (i: Invoice) => InvoiceMutationResult;
  deleteInvoice: (id: string) => InvoiceMutationResult;
  cancelInvoice: (id: string) => InvoiceMutationResult;
  receipts: Receipt[];
  quotations: Quotation[];
  addQuotation: (q: Quotation) => QuotationMutationResult;
  updateQuotation: (q: Quotation) => QuotationMutationResult;
  setQuotationStatus: (id: string, status: 'sent' | 'accepted' | 'rejected') => QuotationMutationResult;
  convertQuotationToInvoice: (id: string) => ConvertQuotationResult;
  payments: PaymentRecord[];
  recordPayment: (input: RecordPaymentInput) => RecordPaymentResult;
  reversePayment: (input: ReversePaymentInput) => ReversePaymentResult;
  voidReceipt: (input: VoidReceiptInput) => VoidReceiptResult;
  notifications: Notification[];
  setNotifications: (n: Notification[]) => void;
  addNotification: (n: Notification) => void;
}

type PersistedAppState = Pick<
  AppState,
  'isAuthenticated' | 'business' | 'settings' | 'paymentMethods' | 'customers' | 'items' | 'invoices' | 'receipts' | 'quotations' | 'payments' | 'notifications'
>;

const appStore = createStore<AppState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      setAuthenticated: (v) => set({ isAuthenticated: v }),
      business: null,
      setBusiness: (business) => {
        const state = get();
        const hasFinancialHistory = state.invoices.length > 0 || state.quotations.length > 0 || state.receipts.length > 0 || state.payments.length > 0;
        const hasCurrencyDependentData = hasFinancialHistory || state.items.length > 0;
        const hasBusinessData = hasFinancialHistory || state.customers.length > 0 || state.items.length > 0 || state.paymentMethods.length > 0;
        if (!business) {
          if (hasBusinessData) {
            return {
              success: false,
              error: 'Business profile cannot be cleared while customer, item, payment-method, or financial data still depends on it.',
            };
          }
          set({ business: null, isAuthenticated: false });
          return { success: true, business: null };
        }
        if (!business.id.trim()) return { success: false, error: 'Business ID is required.' };
        if (!business.name.trim()) return { success: false, error: 'Business name is required.' };
        if (!business.currency.trim()) return { success: false, error: 'Default currency is required.' };

        const normalizedBusiness = sealBusinessRecord(business);
        if (state.business && hasCurrencyDependentData && state.business.currency !== normalizedBusiness.currency) {
          return {
            success: false,
            error: 'Default currency cannot be changed after priced items or financial documents exist because those records depend on the business currency.',
          };
        }
        set({ business: normalizedBusiness });
        return { success: true, business: normalizedBusiness };
      },
      settings: sealAppSettings(DEFAULT_APP_SETTINGS),
      setSettings: (settings) => set({ settings: sealAppSettings(settings) }),
      getBackupData: () => {
        const state = get();
        return deepFreezeClone({
          business: state.business,
          settings: state.settings,
          paymentMethods: state.paymentMethods,
          customers: state.customers,
          items: state.items,
          invoices: state.invoices,
          receipts: state.receipts,
          quotations: state.quotations,
          payments: state.payments,
          notifications: state.notifications,
        });
      },
      restoreBackup: (data) => {
        const validation = validateBackupData(data);
        if (!validation.success) return { success: false, error: validation.error ?? 'Backup data is invalid.' };

        const business = data.business ? sealBusinessRecord(data.business) : null;
        const invoices = sealFinancialCollection<Invoice>((data.invoices ?? []).map((invoice) => (
          invoice.status === 'cancelled' && !invoice.cancelledAt && Number.isFinite(invoice.updatedAt)
            ? { ...invoice, cancelledAt: invoice.updatedAt }
            : invoice
        )));
        const customers = recalculateCustomerBalances(sealMasterCollection(data.customers ?? []), invoices);

        set({
          isAuthenticated: Boolean(business),
          business,
          settings: sealAppSettings(data.settings),
          paymentMethods: sealPaymentMethodCollection(data.paymentMethods ?? []),
          customers,
          items: sealMasterCollection(data.items ?? []),
          invoices,
          receipts: sealFinancialCollection(data.receipts ?? []),
          quotations: sealQuotationCollection(data.quotations ?? []),
          payments: sealFinancialCollection(data.payments ?? []),
          notifications: sealNotificationCollection(data.notifications ?? []),
        });
        return { success: true };
      },
      paymentMethods: sealPaymentMethodCollection([]),
      addPaymentMethod: (method) => {
        const state = get();
        const requestedId = method.id.trim();
        if (requestedId && state.paymentMethods.some((candidate) => candidate.id === requestedId)) {
          return { success: false, error: 'A payment method with this ID already exists.' };
        }
        let id = requestedId || generateId();
        while (state.paymentMethods.some((candidate) => candidate.id === id)) id = generateId();
        const prepared = preparePaymentMethodForStorage(method, state.business, id);
        if (!prepared.success || !prepared.paymentMethod) return prepared;

        const phone = normalizedKey(prepared.paymentMethod.phoneNumber);
        const bank = normalizedKey(prepared.paymentMethod.bankName);
        const account = normalizedKey(prepared.paymentMethod.accountNumber);
        const duplicate = state.paymentMethods.some((candidate) => {
          if (phone && normalizedKey(candidate.phoneNumber) === phone && candidate.type === prepared.paymentMethod!.type) return true;
          return bank && account && normalizedKey(candidate.bankName) === bank && normalizedKey(candidate.accountNumber) === account;
        });
        if (duplicate) return { success: false, error: 'An equivalent payment method already exists.' };

        set({ paymentMethods: sealPaymentMethodCollection([...state.paymentMethods, prepared.paymentMethod as PaymentMethod]) });
        return prepared;
      },
      updatePaymentMethod: (method) => {
        const state = get();
        const existing = state.paymentMethods.find((candidate) => candidate.id === method.id.trim());
        if (!existing) return { success: false, error: 'Payment method not found.' };
        if (state.invoices.some((invoice) => invoice.paymentMethods.includes(existing.id))) {
          return { success: false, error: 'This payment method is referenced by invoice history. Add a new payment method for future invoices instead of changing historical payment instructions.' };
        }
        const prepared = preparePaymentMethodForStorage(method, state.business, existing.id);
        if (!prepared.success || !prepared.paymentMethod) return prepared;

        const phone = normalizedKey(prepared.paymentMethod.phoneNumber);
        const bank = normalizedKey(prepared.paymentMethod.bankName);
        const account = normalizedKey(prepared.paymentMethod.accountNumber);
        const duplicate = state.paymentMethods.some((candidate) => {
          if (candidate.id === existing.id) return false;
          if (phone && normalizedKey(candidate.phoneNumber) === phone && candidate.type === prepared.paymentMethod!.type) return true;
          return bank && account && normalizedKey(candidate.bankName) === bank && normalizedKey(candidate.accountNumber) === account;
        });
        if (duplicate) return { success: false, error: 'Another equivalent payment method already exists.' };

        set({ paymentMethods: sealPaymentMethodCollection(state.paymentMethods.map((candidate) => candidate.id === existing.id ? prepared.paymentMethod as PaymentMethod : candidate)) });
        return prepared;
      },
      deletePaymentMethod: (id) => {
        const state = get();
        const existing = state.paymentMethods.find((candidate) => candidate.id === id);
        if (!existing) return { success: false, error: 'Payment method not found.' };
        if (state.invoices.some((invoice) => invoice.paymentMethods.includes(existing.id))) {
          return { success: false, error: 'This payment method is referenced by invoice history and cannot be removed. Keep it for historical PDFs and add a replacement method for future invoices.' };
        }
        set({ paymentMethods: sealPaymentMethodCollection(state.paymentMethods.filter((candidate) => candidate.id !== id)) });
        return { success: true, paymentMethod: existing };
      },
      currentPage: 'home',
      setCurrentPage: (page) => set({ currentPage: page }),
      showFabMenu: true,
      setShowFabMenu: (v) => set({ showFabMenu: v }),
      sidebarOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      isOnline: navigator.onLine,
      setIsOnline: (v) => set({ isOnline: v }),
      customers: sealMasterCollection<Customer>([]),
      addCustomer: (customer) => {
        const state = get();
        const requestedId = customer.id.trim();
        if (requestedId && state.customers.some((candidate) => candidate.id === requestedId)) {
          return { success: false, error: 'A customer with this ID already exists.' };
        }
        const phone = normalizedKey(customer.phone);
        const email = normalizedKey(customer.email);
        if (phone && state.customers.some((candidate) => normalizedKey(candidate.phone) === phone)) {
          return { success: false, error: 'A customer with this phone number already exists.' };
        }
        if (email && state.customers.some((candidate) => normalizedKey(candidate.email) === email)) {
          return { success: false, error: 'A customer with this email address already exists.' };
        }
        let id = requestedId || generateId();
        while (state.customers.some((candidate) => candidate.id === id)) id = generateId();
        const prepared = prepareCustomerForStorage(customer, id, Date.now(), 0);
        if (!prepared.success || !prepared.customer) return prepared;
        set({ customers: sealMasterCollection([...state.customers, prepared.customer as Customer]) });
        return prepared;
      },
      updateCustomer: (customer) => {
        const state = get();
        const existing = state.customers.find((candidate) => candidate.id === customer.id.trim());
        if (!existing) return { success: false, error: 'Customer not found.' };
        const phone = normalizedKey(customer.phone);
        const email = normalizedKey(customer.email);
        if (phone && state.customers.some((candidate) => candidate.id !== existing.id && normalizedKey(candidate.phone) === phone)) {
          return { success: false, error: 'Another customer already uses this phone number.' };
        }
        if (email && state.customers.some((candidate) => candidate.id !== existing.id && normalizedKey(candidate.email) === email)) {
          return { success: false, error: 'Another customer already uses this email address.' };
        }
        const prepared = prepareCustomerForStorage(customer, existing.id, existing.createdAt, existing.outstandingBalance);
        if (!prepared.success || !prepared.customer) return prepared;
        const customers = recalculateCustomerBalances(
          sealMasterCollection(state.customers.map((candidate) => candidate.id === existing.id ? prepared.customer as Customer : candidate)),
          state.invoices,
        );
        set({ customers });
        return { success: true, customer: customers.find((candidate) => candidate.id === existing.id) };
      },
      deleteCustomer: (id) => {
        const state = get();
        const customer = state.customers.find((candidate) => candidate.id === id);
        if (!customer) return { success: false, error: 'Customer not found.' };

        const hasInvoiceHistory = state.invoices.some((invoice) => invoice.customerId === id);
        const hasQuotationHistory = state.quotations.some((quotation) => quotation.customerId === id);
        const hasPaymentHistory = state.payments.some((payment) => payment.customerId === id);
        const hasReceiptHistory = state.receipts.some((receipt) => receipt.customerId === id);
        if (hasInvoiceHistory || hasQuotationHistory || hasPaymentHistory || hasReceiptHistory) {
          return {
            success: false,
            error: 'Customers with invoice, quotation, payment, or receipt history cannot be deleted because document references must be preserved.',
          };
        }

        set({ customers: sealMasterCollection(state.customers.filter((candidate) => candidate.id !== id)) });
        return { success: true, customer };
      },
      items: sealMasterCollection<Item>([]),
      addItem: (item) => {
        const state = get();
        if (state.items.some((candidate) => candidate.id === item.id.trim())) return { success: false, error: 'An item with this ID already exists.' };
        const sku = item.sku.trim().toLowerCase();
        if (sku && state.items.some((candidate) => candidate.sku.trim().toLowerCase() === sku)) return { success: false, error: 'An item with this SKU already exists.' };
        const barcode = item.barcode.trim().toLowerCase();
        if (barcode && state.items.some((candidate) => candidate.barcode.trim().toLowerCase() === barcode)) return { success: false, error: 'An item with this barcode already exists.' };
        const prepared = prepareItemForStorage(item, state.business, Date.now());
        if (!prepared.success || !prepared.item) return prepared;
        set({ items: sealMasterCollection([...state.items, prepared.item as Item]) });
        return prepared;
      },
      updateItem: (item) => {
        const state = get();
        const existing = state.items.find((candidate) => candidate.id === item.id);
        if (!existing) return { success: false, error: 'Item not found.' };
        const sku = item.sku.trim().toLowerCase();
        if (sku && state.items.some((candidate) => candidate.id !== existing.id && candidate.sku.trim().toLowerCase() === sku)) return { success: false, error: 'Another item already uses this SKU.' };
        const barcode = item.barcode.trim().toLowerCase();
        if (barcode && state.items.some((candidate) => candidate.id !== existing.id && candidate.barcode.trim().toLowerCase() === barcode)) return { success: false, error: 'Another item already uses this barcode.' };
        const prepared = prepareItemForStorage({ ...item, id: existing.id }, state.business, existing.createdAt);
        if (!prepared.success || !prepared.item) return prepared;
        set({ items: sealMasterCollection(state.items.map((candidate) => candidate.id === existing.id ? prepared.item as Item : candidate)) });
        return prepared;
      },
      deleteItem: (id) => {
        const state = get();
        const item = state.items.find((candidate) => candidate.id === id);
        if (!item) return { success: false, error: 'Item not found.' };
        const usedByInvoice = state.invoices.some((invoice) => invoice.items.some((line) => line.itemId === id));
        const usedByQuotation = state.quotations.some((quotation) => quotation.items.some((line) => line.itemId === id));
        if (usedByInvoice || usedByQuotation) {
          return { success: false, error: 'Items referenced by invoice or quotation history cannot be deleted. Edit the item instead so historical references remain intact.' };
        }
        set({ items: sealMasterCollection(state.items.filter((candidate) => candidate.id !== id)) });
        return { success: true, item };
      },
      invoices: sealFinancialCollection<Invoice>([]),
      addInvoice: (invoice) => {
        const state = get();
        const now = Date.now();
        if (state.invoices.some((candidate) => candidate.id === invoice.id.trim())) {
          return { success: false, error: 'An invoice with this ID already exists.' };
        }
        if (state.invoices.some((candidate) => candidate.number.toLowerCase() === invoice.number.trim().toLowerCase())) {
          return { success: false, error: 'An invoice with this number already exists.' };
        }
        if (invoice.amountPaid !== 0) {
          return { success: false, error: 'New invoices must start with zero amount paid. Record payments through the payment workflow.' };
        }
        if (['partially_paid', 'paid', 'cancelled'].includes(invoice.status)) {
          return { success: false, error: 'New invoices must start as Draft or Issued.' };
        }

        const requireComplete = invoice.status !== 'draft';
        const prepared = prepareInvoiceForStorage(invoice, requireComplete);
        if (!prepared.success || !prepared.invoice) return prepared;
        const missingItemReference = prepared.invoice.items.find((line) => line.itemId.trim() && !state.items.some((item) => item.id === line.itemId.trim()));
        if (missingItemReference) return { success: false, error: `Invoice references missing item ${missingItemReference.itemId}.` };
        const selectedPaymentMethodIds = prepared.invoice.paymentMethods.map((id) => id.trim()).filter(Boolean);
        if (new Set(selectedPaymentMethodIds).size !== selectedPaymentMethodIds.length) return { success: false, error: 'Invoice contains duplicate payment-method references.' };
        const missingPaymentMethodId = selectedPaymentMethodIds.find((id) => !state.paymentMethods.some((method) => method.id === id));
        if (missingPaymentMethodId) return { success: false, error: `Invoice references missing payment method ${missingPaymentMethodId}.` };
        prepared.invoice.paymentMethods = selectedPaymentMethodIds;
        if (requireComplete && !state.customers.some((customer) => customer.id === prepared.invoice!.customerId)) {
          return { success: false, error: 'The selected customer no longer exists. Select an active customer before issuing the invoice.' };
        }

        const amountPaid = 0;
        const baseStatus: Invoice['status'] = invoice.status === 'draft' ? 'draft' : 'unpaid';
        const status = resolveInvoiceStatus({
          status: baseStatus,
          grandTotal: prepared.invoice.grandTotal,
          amountPaid,
          dueDate: prepared.invoice.dueDate,
        });
        const storedInvoice = sealFinancialRecord<Invoice>({
          ...prepared.invoice,
          cancelledAt: undefined,
          amountPaid,
          balanceDue: status === 'cancelled' ? 0 : prepared.invoice.grandTotal,
          status,
          createdAt: now,
          updatedAt: now,
        });
        const invoices = sealFinancialCollection<Invoice>([storedInvoice, ...state.invoices]);
        set({ invoices, customers: recalculateCustomerBalances(state.customers, invoices) });
        return { success: true, invoice: storedInvoice };
      },
      updateInvoice: (invoice) => {
        const state = get();
        const existing = state.invoices.find((candidate) => candidate.id === invoice.id);
        if (!existing) return { success: false, error: 'Invoice not found.' };

        const hasPaymentHistory = state.payments.some((payment) => payment.invoiceId === existing.id);
        const hasReceiptHistory = state.receipts.some((receipt) => receipt.linkedInvoiceId === existing.id);
        const lockReason = getInvoiceEditLockReason(existing, hasPaymentHistory, hasReceiptHistory);
        if (lockReason) return { success: false, error: lockReason };

        if (invoice.status === 'cancelled') {
          return { success: false, error: 'Use the cancel invoice action to cancel an issued invoice.' };
        }

        const canRemainDraft = existing.status === 'draft' && invoice.status === 'draft';
        const prepared = prepareInvoiceForStorage(invoice, !canRemainDraft);
        if (!prepared.success || !prepared.invoice) return prepared;
        const missingItemReference = prepared.invoice.items.find((line) => line.itemId.trim() && !state.items.some((item) => item.id === line.itemId.trim()));
        if (missingItemReference) return { success: false, error: `Invoice references missing item ${missingItemReference.itemId}.` };
        const selectedPaymentMethodIds = prepared.invoice.paymentMethods.map((id) => id.trim()).filter(Boolean);
        if (new Set(selectedPaymentMethodIds).size !== selectedPaymentMethodIds.length) return { success: false, error: 'Invoice contains duplicate payment-method references.' };
        const missingPaymentMethodId = selectedPaymentMethodIds.find((id) => !state.paymentMethods.some((method) => method.id === id));
        if (missingPaymentMethodId) return { success: false, error: `Invoice references missing payment method ${missingPaymentMethodId}.` };
        prepared.invoice.paymentMethods = selectedPaymentMethodIds;
        if (!canRemainDraft && !state.customers.some((customer) => customer.id === prepared.invoice!.customerId)) {
          return { success: false, error: 'The selected customer no longer exists. Select an active customer before issuing the invoice.' };
        }

        const amountPaid = existing.amountPaid;
        const baseStatus: Invoice['status'] = canRemainDraft ? 'draft' : 'unpaid';
        const updatedInvoice = sealFinancialRecord<Invoice>({
          ...prepared.invoice,
          id: existing.id,
          number: existing.number,
          cancelledAt: existing.cancelledAt,
          amountPaid,
          balanceDue: roundMoney(Math.max(prepared.invoice.grandTotal - amountPaid, 0)),
          status: resolveInvoiceStatus({
            status: baseStatus,
            grandTotal: prepared.invoice.grandTotal,
            amountPaid,
            dueDate: prepared.invoice.dueDate,
          }),
          createdAt: existing.createdAt,
          updatedAt: Date.now(),
        });

        const invoices = sealFinancialCollection<Invoice>(
          state.invoices.map((candidate) => candidate.id === existing.id ? updatedInvoice : candidate),
        );
        set({
          invoices,
          customers: recalculateCustomerBalances(state.customers, invoices),
        });
        return { success: true, invoice: updatedInvoice };
      },
      deleteInvoice: (id) => {
        const state = get();
        const invoice = state.invoices.find((candidate) => candidate.id === id);
        if (!invoice) return { success: false, error: 'Invoice not found.' };

        const hasLinkedPayments = state.payments.some((payment) => payment.invoiceId === id);
        const hasLinkedReceipts = state.receipts.some((receipt) => receipt.linkedInvoiceId === id);
        if (hasLinkedPayments || hasLinkedReceipts || invoice.amountPaid > 0) {
          return {
            success: false,
            error: 'Invoices with payment or receipt history cannot be deleted because the audit trail must be preserved.',
          };
        }

        if (getInvoiceStatus(invoice) !== 'draft') {
          return { success: false, error: 'Issued invoices cannot be deleted. Cancel the invoice instead.' };
        }

        const invoices = sealFinancialCollection<Invoice>(state.invoices.filter((candidate) => candidate.id !== id));
        set({
          invoices,
          customers: recalculateCustomerBalances(state.customers, invoices),
        });
        return { success: true, invoice };
      },
      cancelInvoice: (id) => {
        const state = get();
        const invoice = state.invoices.find((candidate) => candidate.id === id);
        if (!invoice) return { success: false, error: 'Invoice not found.' };

        const status = getInvoiceStatus(invoice);
        if (status === 'cancelled') return { success: false, error: 'This invoice is already cancelled.' };
        if (status === 'draft') return { success: false, error: 'Draft invoices should be deleted instead of cancelled.' };

        const hasLinkedPayments = state.payments.some((payment) => payment.invoiceId === id && !isPaymentReversed(payment));
        const hasLinkedReceipts = state.receipts.some((receipt) => receipt.linkedInvoiceId === id && !isReceiptVoided(receipt));
        if (hasLinkedPayments || hasLinkedReceipts || invoice.amountPaid > 0) {
          return {
            success: false,
            error: 'Invoices with active payment or receipt history cannot be cancelled until those transactions are reversed.',
          };
        }

        const cancelledAt = Date.now();
        const updatedInvoice = sealFinancialRecord<Invoice>({
          ...invoice,
          status: 'cancelled',
          balanceDue: 0,
          cancelledAt,
          updatedAt: cancelledAt,
        });
        const invoices = sealFinancialCollection<Invoice>(
          state.invoices.map((candidate) => candidate.id === id ? updatedInvoice : candidate),
        );
        set({
          invoices,
          customers: recalculateCustomerBalances(state.customers, invoices),
        });
        return { success: true, invoice: updatedInvoice };
      },
      receipts: sealFinancialCollection<Receipt>([]),
      quotations: sealQuotationCollection([]),
      addQuotation: (quotation) => {
        const state = get();
        const now = Date.now();
        if (state.quotations.some((candidate) => candidate.id === quotation.id)) {
          return { success: false, error: 'A quotation with this ID already exists.' };
        }
        if (state.quotations.some((candidate) => candidate.number.toLowerCase() === quotation.number.trim().toLowerCase())) {
          return { success: false, error: 'A quotation with this number already exists.' };
        }
        if (quotation.status !== 'draft' && quotation.status !== 'sent') {
          return { success: false, error: 'New quotations must start as Draft or Sent.' };
        }
        if (quotation.status === 'sent' && !state.customers.some((customer) => customer.id === quotation.customerId.trim())) {
          return { success: false, error: 'The selected customer no longer exists. Select an active customer before sending the quotation.' };
        }

        const prepared = prepareQuotationForStorage(quotation, quotation.status === 'sent');
        if (!prepared.success || !prepared.quotation) return prepared;
        const missingItemReference = prepared.quotation.items.find((line) => line.itemId.trim() && !state.items.some((item) => item.id === line.itemId.trim()));
        if (missingItemReference) return { success: false, error: `Quotation references missing item ${missingItemReference.itemId}.` };
        if (quotation.status === 'sent' && getQuotationStatus(prepared.quotation) === 'expired') {
          return { success: false, error: 'An expired quotation cannot be sent. Extend the expiry date first.' };
        }

        const storedQuotation = sealQuotationRecord({
          ...prepared.quotation,
          status: quotation.status,
          convertedInvoiceId: undefined,
          convertedAt: undefined,
          createdAt: now,
          updatedAt: now,
        });
        set({ quotations: sealQuotationCollection([storedQuotation, ...state.quotations]) });
        return { success: true, quotation: storedQuotation };
      },
      updateQuotation: (quotation) => {
        const state = get();
        const existing = state.quotations.find((candidate) => candidate.id === quotation.id);
        if (!existing) return { success: false, error: 'Quotation not found.' };

        const lockReason = getQuotationEditLockReason(existing);
        if (lockReason) return { success: false, error: lockReason };

        const resolvedExistingStatus = getQuotationStatus(existing);
        const requireComplete = existing.status !== 'draft';
        const prepared = prepareQuotationForStorage(quotation, requireComplete);
        if (!prepared.success || !prepared.quotation) return prepared;
        const missingItemReference = prepared.quotation.items.find((line) => line.itemId.trim() && !state.items.some((item) => item.id === line.itemId.trim()));
        if (missingItemReference) return { success: false, error: `Quotation references missing item ${missingItemReference.itemId}.` };

        let storedStatus = existing.status;
        const wasCustomerFacing = existing.status === 'sent' || existing.status === 'expired' || resolvedExistingStatus === 'expired';
        const materiallyRevised = !quotationRevisionInputsMatch(existing, prepared.quotation);

        if (wasCustomerFacing && materiallyRevised) {
          storedStatus = 'draft';
        } else if (existing.status === 'expired' && prepared.quotation.expiryDate >= Date.now()) {
          // Legacy `expired` records whose source terms did not change may return to Sent.
          // Changing validity or any other customer-facing term is a revision and resets to Draft above.
          storedStatus = 'sent';
        } else if (resolvedExistingStatus === 'expired' && existing.status === 'sent') {
          storedStatus = 'sent';
        }

        const updatedQuotation = sealQuotationRecord({
          ...prepared.quotation,
          id: existing.id,
          number: existing.number,
          status: storedStatus,
          convertedInvoiceId: existing.convertedInvoiceId,
          convertedAt: existing.convertedAt,
          createdAt: existing.createdAt,
          updatedAt: Date.now(),
        });
        set({
          quotations: sealQuotationCollection(
            state.quotations.map((candidate) => candidate.id === existing.id ? updatedQuotation : candidate),
          ),
        });
        return { success: true, quotation: updatedQuotation };
      },
      setQuotationStatus: (id, status) => {
        const state = get();
        const quotation = state.quotations.find((candidate) => candidate.id === id);
        if (!quotation) return { success: false, error: 'Quotation not found.' };
        if (quotation.convertedInvoiceId) return { success: false, error: 'Converted quotations cannot change status.' };

        const currentStatus = getQuotationStatus(quotation);
        if (currentStatus === 'expired') {
          return { success: false, error: 'This quotation has expired. Extend the expiry date before changing its status.' };
        }
        if (currentStatus === 'accepted' || currentStatus === 'rejected') {
          return { success: false, error: `This quotation is already ${currentStatus}.` };
        }
        if (!state.customers.some((customer) => customer.id === quotation.customerId.trim())) {
          return { success: false, error: 'The quotation customer no longer exists. Select an active customer before continuing the quotation workflow.' };
        }

        if (status === 'sent') {
          if (currentStatus !== 'draft') {
            return { success: false, error: 'Only Draft quotations can be marked Sent.' };
          }
          const prepared = prepareQuotationForStorage(quotation, true);
          if (!prepared.success || !prepared.quotation) return prepared;
          if (getQuotationStatus(prepared.quotation) === 'expired') {
            return { success: false, error: 'An expired quotation cannot be sent. Extend the expiry date first.' };
          }
          const updatedQuotation = sealQuotationRecord({ ...prepared.quotation, status: 'sent', updatedAt: Date.now() });
          set({ quotations: sealQuotationCollection(state.quotations.map((candidate) => candidate.id === id ? updatedQuotation : candidate)) });
          return { success: true, quotation: updatedQuotation };
        }

        if (currentStatus !== 'sent') {
          return { success: false, error: `Quotation must be Sent before it can be ${status}.` };
        }

        if (status === 'accepted') {
          const prepared = prepareQuotationForStorage(quotation, true);
          if (!prepared.success || !prepared.quotation) return prepared;
          if (!quotationDerivedValuesMatch(quotation, prepared.quotation)) {
            return { success: false, error: 'Quotation totals require reconciliation. Edit and save the quotation before accepting it.' };
          }
          const updatedQuotation = sealQuotationRecord({ ...prepared.quotation, status: 'accepted', updatedAt: Date.now() });
          set({ quotations: sealQuotationCollection(state.quotations.map((candidate) => candidate.id === id ? updatedQuotation : candidate)) });
          return { success: true, quotation: updatedQuotation };
        }

        const prepared = prepareQuotationForStorage(quotation, true);
        if (!prepared.success || !prepared.quotation) return prepared;
        const updatedQuotation = sealQuotationRecord({ ...prepared.quotation, status: 'rejected', updatedAt: Date.now() });
        set({ quotations: sealQuotationCollection(state.quotations.map((candidate) => candidate.id === id ? updatedQuotation : candidate)) });
        return { success: true, quotation: updatedQuotation };
      },
      convertQuotationToInvoice: (id) => {
        const state = get();
        const quotation = state.quotations.find((candidate) => candidate.id === id);
        if (!quotation) return { success: false, error: 'Quotation not found.' };
        if (quotation.convertedInvoiceId) return { success: false, error: 'This quotation has already been converted to an invoice.' };

        const quotationStatus = getQuotationStatus(quotation);
        if (quotationStatus !== 'accepted') {
          if (quotationStatus === 'draft') return { success: false, error: 'Draft quotations must be marked Sent and Accepted before conversion.' };
          if (quotationStatus === 'sent') return { success: false, error: 'Quotation must be Accepted before conversion.' };
          if (quotationStatus === 'rejected') return { success: false, error: 'Rejected quotations cannot be converted.' };
          if (quotationStatus === 'expired') return { success: false, error: 'Expired quotations must be extended, sent, and accepted before conversion.' };
          return { success: false, error: 'Quotation is not eligible for conversion.' };
        }

        const prepared = prepareQuotationForStorage(quotation, true);
        if (!prepared.success || !prepared.quotation) {
          return { success: false, error: prepared.error ?? 'Accepted quotation requires reconciliation before conversion.' };
        }
        // Legacy accepted quotations may have stale derived totals. The line-item terms
        // remain authoritative, so conversion normalizes those derived fields rather than
        // leaving an accepted quotation permanently deadlocked.
        const normalizedQuotation = prepared.quotation;
        const total = normalizedQuotation.total;
        if (total <= 0) return { success: false, error: 'Quotation total must be greater than 0 before conversion.' };

        const now = Date.now();
        const issue = new Date(now);
        issue.setHours(0, 0, 0, 0);
        const due = new Date(issue.getTime());
        due.setDate(due.getDate() + paymentTermDays(state.settings.document.defaultInvoicePaymentTerms));
        due.setHours(23, 59, 59, 999);
        const customer = state.customers.find((candidate) => candidate.id === normalizedQuotation.customerId);
        if (!customer) {
          return { success: false, error: 'The quotation customer no longer exists. Restore or replace the customer before conversion.' };
        }
        let invoiceId = generateId();
        while (state.invoices.some((candidate) => candidate.id === invoiceId)) invoiceId = generateId();
        const invoiceNumber = generateDocumentNumber(state.settings.document.invoicePrefix, state.invoices.map((candidate) => candidate.number));
        if (state.invoices.some((candidate) => candidate.number.toLowerCase() === invoiceNumber.toLowerCase())) {
          return { success: false, error: 'Unable to generate a unique invoice number. Reconcile invoice numbering before conversion.' };
        }
        const invoiceCandidate: Invoice = {
          id: invoiceId,
          number: invoiceNumber,
          customerId: normalizedQuotation.customerId,
          customerName: normalizedQuotation.customerName,
          customerPhone: normalizedQuotation.customerPhone ?? customer.phone ?? '',
          customerAddress: normalizedQuotation.customerAddress ?? customer.address ?? '',
          customerTpin: normalizedQuotation.customerTpin ?? customer.tpin ?? '',
          items: normalizedQuotation.items,
          subtotal: normalizedQuotation.subtotal,
          discount: normalizedQuotation.discount,
          tax: normalizedQuotation.tax,
          shipping: 0,
          grandTotal: total,
          amountPaid: 0,
          balanceDue: total,
          issueDate: issue.getTime(),
          dueDate: due.getTime(),
          referenceNumber: normalizedQuotation.number,
          purchaseOrderNumber: '',
          paymentTerms: state.settings.document.defaultInvoicePaymentTerms,
          paymentMethods: [],
          notes: normalizedQuotation.notes,
          terms: normalizedQuotation.terms,
          attachment: '',
          status: 'unpaid',
          createdAt: now,
          updatedAt: now,
        };
        const preparedInvoice = prepareInvoiceForStorage(invoiceCandidate, true);
        if (!preparedInvoice.success || !preparedInvoice.invoice) {
          return { success: false, error: preparedInvoice.error ?? 'Unable to prepare the invoice from this quotation.' };
        }
        const invoice = sealFinancialRecord<Invoice>({
          ...preparedInvoice.invoice,
          amountPaid: 0,
          balanceDue: preparedInvoice.invoice.grandTotal,
          status: resolveInvoiceStatus({
            status: 'unpaid',
            grandTotal: preparedInvoice.invoice.grandTotal,
            amountPaid: 0,
            dueDate: preparedInvoice.invoice.dueDate,
          }, now),
        });
        const updatedQuotation = sealQuotationRecord({
          ...normalizedQuotation,
          status: 'accepted',
          convertedInvoiceId: invoice.id,
          convertedAt: now,
          updatedAt: now,
        });
        const invoices = sealFinancialCollection<Invoice>([invoice, ...state.invoices]);
        set({
          invoices,
          quotations: sealQuotationCollection(
            state.quotations.map((candidate) => candidate.id === id ? updatedQuotation : candidate),
          ),
          customers: recalculateCustomerBalances(state.customers, invoices),
        });
        return { success: true, quotation: updatedQuotation, invoice };
      },
      payments: sealFinancialCollection<PaymentRecord>([]),
      recordPayment: (input) => {
        const state = get();
        const now = Date.now();
        const amount = roundMoney(input.amount);
        const referenceNumber = input.referenceNumber?.trim() ?? '';
        const notes = input.notes?.trim() ?? '';
        const method = input.method.trim();

        if (!isSafeMoneyAmount(amount) || amount <= 0) {
          return { success: false, error: 'Payment amount must be a valid money amount greater than 0.' };
        }
        if (!isValidTimestamp(input.date)) {
          return { success: false, error: 'Enter a valid payment date.' };
        }
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (input.date > endOfToday.getTime()) {
          return { success: false, error: 'Payment date cannot be in the future.' };
        }
        if (!method) {
          return { success: false, error: 'Select a payment method.' };
        }

        const invoice = input.invoiceId
          ? state.invoices.find((candidate) => candidate.id === input.invoiceId)
          : undefined;

        if (input.invoiceId && !invoice) {
          return { success: false, error: 'The selected invoice could not be found.' };
        }

        if (invoice) {
          if (![invoice.grandTotal, invoice.amountPaid, invoice.balanceDue].every(isSafeMoneyAmount)) {
            return { success: false, error: 'Invoice financial values are invalid. Reconcile the invoice before recording a payment.' };
          }
          if (input.date < invoice.issueDate) {
            return { success: false, error: 'Payment date cannot be earlier than the invoice issue date.' };
          }
          const activePaymentTotal = roundMoney(
            state.payments
              .filter((payment) => payment.invoiceId === invoice.id && !isPaymentReversed(payment))
              .reduce((sum, payment) => sum + payment.amount, 0),
          );
          if (activePaymentTotal !== roundMoney(invoice.amountPaid)) {
            return {
              success: false,
              error: 'Payment history requires reconciliation before recording another payment because the active payments do not match the invoice amount paid.',
            };
          }

          const invoiceStatus = getInvoiceStatus(invoice);
          if (invoiceStatus === 'draft') return { success: false, error: 'Draft invoices cannot receive payments.' };
          if (invoiceStatus === 'cancelled') return { success: false, error: 'Cancelled invoices cannot receive payments.' };
          if (invoiceStatus === 'paid') return { success: false, error: 'This invoice is already paid in full.' };

          const outstanding = roundMoney(Math.max(invoice.grandTotal - invoice.amountPaid, 0));
          if (amount > outstanding) {
            return { success: false, error: `Payment cannot exceed the outstanding balance of ${state.business?.currency || 'ZMW'} ${outstanding.toLocaleString('en-ZM', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}.` };
          }

        }

        const customerId = invoice?.customerId ?? input.customerId?.trim() ?? '';
        const standaloneCustomer = !invoice && customerId ? state.customers.find((candidate) => candidate.id === customerId) : undefined;
        if (!invoice && customerId && !standaloneCustomer) {
          return { success: false, error: 'The selected customer could not be found.' };
        }
        const customerName = invoice?.customerName ?? standaloneCustomer?.name ?? input.customerName?.trim() ?? '';
        if (!customerName) {
          return { success: false, error: 'Customer or payer name is required.' };
        }

        if (referenceNumber) {
          const normalizedReference = referenceNumber.toLowerCase();
          const duplicateReference = state.payments.some((payment) => {
            if (isPaymentReversed(payment)) return false;
            if (payment.referenceNumber.trim().toLowerCase() !== normalizedReference) return false;
            if (invoice) return payment.invoiceId === invoice.id;
            if (payment.invoiceId) return false;
            if (customerId && payment.customerId) return payment.customerId === customerId;
            return payment.customerName.trim().toLowerCase() === customerName.toLowerCase();
          });
          if (duplicateReference) {
            return { success: false, error: invoice
              ? 'A payment with this reference number already exists for the invoice.'
              : 'A standalone payment with this reference number already exists for this payer.' };
          }
        }

        let paymentId = generateId();
        while (state.payments.some((candidate) => candidate.id === paymentId)) paymentId = generateId();
        let receiptId = input.createReceipt ? generateId() : '';
        while (receiptId && state.receipts.some((candidate) => candidate.id === receiptId)) receiptId = generateId();
        let receipt: Receipt | undefined;
        if (input.createReceipt) {
          const receiptNumber = generateDocumentNumber(state.settings.document.receiptPrefix, state.receipts.map((item) => item.number));
          if (state.receipts.some((candidate) => candidate.number.trim().toLowerCase() === receiptNumber.toLowerCase())) {
            return { success: false, error: 'Unable to generate a unique receipt number. Reconcile receipt numbering before recording this payment.' };
          }
          receipt = sealFinancialRecord<Receipt>({
            id: receiptId,
            number: receiptNumber,
            date: input.date,
            receivedFrom: customerName,
            customerId,
            customerName,
            amountReceived: amount,
            paymentMethod: method,
            referenceNumber,
            paymentFor: invoice ? `Invoice ${invoice.number}` : 'Payment',
            linkedInvoiceId: invoice?.id ?? '',
            paymentId,
            notes,
            status: 'active',
            createdAt: now,
          });
        }

        const payment = sealFinancialRecord<PaymentRecord>({
          id: paymentId,
          invoiceId: invoice?.id ?? '',
          customerId,
          customerName,
          amount,
          date: input.date,
          method,
          referenceNumber,
          notes,
          receiptId,
          status: 'active',
          createdAt: now,
        });

        let updatedInvoice: Invoice | undefined;
        let invoices = state.invoices;
        if (invoice) {
          const amountPaid = roundMoney(invoice.amountPaid + amount);
          const balanceDue = roundMoney(Math.max(invoice.grandTotal - amountPaid, 0));
          const status = resolveInvoiceStatus({
            status: invoice.status === 'cancelled' ? 'cancelled' : 'unpaid',
            grandTotal: invoice.grandTotal,
            amountPaid,
            dueDate: invoice.dueDate,
          }, now);
          updatedInvoice = sealFinancialRecord<Invoice>({
            ...invoice,
            amountPaid,
            balanceDue,
            status,
            updatedAt: now,
          });
          invoices = sealFinancialCollection(
            state.invoices.map((candidate) => candidate.id === invoice.id ? updatedInvoice! : candidate),
          );
        }

        set({
          invoices: sealFinancialCollection(invoices),
          payments: sealFinancialCollection([payment, ...state.payments]),
          receipts: receipt ? sealFinancialCollection([receipt, ...state.receipts]) : state.receipts,
          customers: recalculateCustomerBalances(state.customers, invoices),
        });

        return { success: true, payment, receipt, invoice: updatedInvoice };
      },
      reversePayment: (input) => {
        const state = get();
        const payment = state.payments.find((candidate) => candidate.id === input.paymentId);
        if (!payment) return { success: false, error: 'Payment not found.' };
        if (isPaymentReversed(payment)) return { success: false, error: 'This payment has already been reversed.' };

        const reason = input.reason.trim();
        const reversalNotes = input.notes?.trim() ?? '';
        if (!reason) return { success: false, error: 'A reversal reason is required.' };

        const now = Date.now();
        let updatedInvoice: Invoice | undefined;
        let invoices = state.invoices;

        if (payment.invoiceId) {
          const invoice = state.invoices.find((candidate) => candidate.id === payment.invoiceId);
          if (!invoice) {
            return { success: false, error: 'The linked invoice is missing. Reconcile this payment before reversing it.' };
          }

          const activePaymentTotal = roundMoney(
            state.payments
              .filter((candidate) => candidate.invoiceId === invoice.id && !isPaymentReversed(candidate))
              .reduce((sum, candidate) => sum + candidate.amount, 0),
          );
          if (activePaymentTotal !== roundMoney(invoice.amountPaid)) {
            return {
              success: false,
              error: 'Payment history requires reconciliation before reversal because the active payments do not match the invoice amount paid.',
            };
          }

          const nextAmountPaid = roundMoney(invoice.amountPaid - payment.amount);
          if (nextAmountPaid < 0) {
            return { success: false, error: 'Invoice payment history is inconsistent. Reconciliation is required before reversal.' };
          }

          const statusSeed: Invoice['status'] = invoice.status === 'cancelled'
            ? 'cancelled'
            : invoice.status === 'draft' ? 'draft' : 'unpaid';
          const amountPaid = Math.max(nextAmountPaid, 0);
          const balanceDue = invoice.status === 'cancelled'
            ? 0
            : roundMoney(Math.max(invoice.grandTotal - amountPaid, 0));
          const status = resolveInvoiceStatus({
            status: statusSeed,
            grandTotal: invoice.grandTotal,
            amountPaid,
            dueDate: invoice.dueDate,
          }, now);

          updatedInvoice = sealFinancialRecord<Invoice>({
            ...invoice,
            amountPaid,
            balanceDue,
            status,
            updatedAt: now,
          });
          invoices = sealFinancialCollection(
            state.invoices.map((candidate) => candidate.id === invoice.id ? updatedInvoice! : candidate),
          );
        }

        const updatedPayment = sealFinancialRecord<PaymentRecord>({
          ...payment,
          status: 'reversed',
          reversedAt: now,
          reversalReason: reason,
          reversalNotes,
        });
        const payments = sealFinancialCollection(
          state.payments.map((candidate) => candidate.id === payment.id ? updatedPayment : candidate),
        );

        const linkedReceipts = state.receipts.filter((candidate) =>
          candidate.id === payment.receiptId || candidate.paymentId === payment.id,
        );
        if (linkedReceipts.length > 1) {
          return { success: false, error: 'This payment is linked to more than one receipt. Reconcile the audit trail before reversing it.' };
        }
        const linkedReceipt = linkedReceipts[0];
        const receiptRelationshipError = validatePaymentReceiptRelationship(payment, linkedReceipt);
        if (receiptRelationshipError) return { success: false, error: receiptRelationshipError };
        let updatedReceipt: Receipt | undefined;
        let receipts = state.receipts;
        if (linkedReceipt && !isReceiptVoided(linkedReceipt)) {
          updatedReceipt = sealFinancialRecord<Receipt>({
            ...linkedReceipt,
            status: 'voided',
            voidedAt: now,
            voidReason: `Payment reversed: ${reason}`,
          });
          receipts = sealFinancialCollection(
            state.receipts.map((candidate) => candidate.id === linkedReceipt.id ? updatedReceipt! : candidate),
          );
        }

        set({
          invoices: sealFinancialCollection(invoices),
          payments,
          receipts: sealFinancialCollection(receipts),
          customers: recalculateCustomerBalances(state.customers, invoices),
        });

        return { success: true, payment: updatedPayment, receipt: updatedReceipt, invoice: updatedInvoice };
      },
      voidReceipt: (input) => {
        const state = get();
        const receipt = state.receipts.find((candidate) => candidate.id === input.receiptId);
        if (!receipt) return { success: false, error: 'Receipt not found.' };
        if (isReceiptVoided(receipt)) return { success: false, error: 'This receipt has already been voided.' };

        const reason = input.reason.trim();
        if (!reason) return { success: false, error: 'A void reason is required.' };

        const linkedPayment = state.payments.find((payment) =>
          payment.id === receipt.paymentId || payment.receiptId === receipt.id,
        );
        if (linkedPayment) {
          const relatedReceipts = state.receipts.filter((candidate) =>
            candidate.id === linkedPayment.receiptId || candidate.paymentId === linkedPayment.id,
          );
          if (relatedReceipts.length > 1) {
            return { success: false, error: 'This payment is linked to more than one receipt. Reconcile the audit trail before voiding a receipt.' };
          }
          const receiptRelationshipError = validatePaymentReceiptRelationship(linkedPayment, receipt);
          if (receiptRelationshipError && !(isPaymentReversed(linkedPayment) && !isReceiptVoided(receipt))) {
            return { success: false, error: receiptRelationshipError };
          }
        }
        if (linkedPayment && !isPaymentReversed(linkedPayment)) {
          return { success: false, error: 'This receipt has an active payment. Reverse the payment instead so balances stay consistent.' };
        }
        if (receipt.linkedInvoiceId && !linkedPayment) {
          return { success: false, error: 'This legacy receipt is linked to an invoice without a payment record. Reconciliation is required before voiding it.' };
        }

        const updatedReceipt = sealFinancialRecord<Receipt>({
          ...receipt,
          status: 'voided',
          voidedAt: Date.now(),
          voidReason: reason,
        });
        const receipts = sealFinancialCollection(
          state.receipts.map((candidate) => candidate.id === receipt.id ? updatedReceipt : candidate),
        );
        set({ receipts });
        return { success: true, receipt: updatedReceipt };
      },
      notifications: sealNotificationCollection([]),
      setNotifications: (n) => set({ notifications: sealNotificationCollection(n) }),
      addNotification: (n) => set((state) => ({ notifications: sealNotificationCollection([n, ...state.notifications]) })),
    }),
    {
      name: 'invoice-maker-storage',
      version: PERSISTENCE_VERSION,
      migrate: (persistedState) => persistedState as PersistedAppState,
      partialize: (state): PersistedAppState => ({
        isAuthenticated: state.isAuthenticated,
        business: state.business,
        settings: state.settings,
        paymentMethods: state.paymentMethods,
        customers: state.customers,
        items: state.items,
        invoices: state.invoices,
        receipts: state.receipts,
        quotations: state.quotations,
        payments: state.payments,
        notifications: state.notifications,
      }),
      merge: (persistedState, currentState) => {
        const restored = { ...currentState, ...(persistedState as Partial<AppState>) };
        const business = restored.business ? sealBusinessRecord(restored.business) : null;
        const invoices = sealFinancialCollection<Invoice>((restored.invoices ?? []).map((invoice) => (
          invoice.status === 'cancelled' && !invoice.cancelledAt && Number.isFinite(invoice.updatedAt)
            ? { ...invoice, cancelledAt: invoice.updatedAt }
            : invoice
        )));
        const customers = recalculateCustomerBalances(sealMasterCollection(restored.customers ?? []), invoices);
        return {
          ...restored,
          isAuthenticated: Boolean(business),
          business,
          settings: sealAppSettings(normalizeAppSettings(restored.settings)),
          paymentMethods: sealPaymentMethodCollection(restored.paymentMethods ?? []),
          customers,
          items: sealMasterCollection(restored.items ?? []),
          invoices,
          payments: sealFinancialCollection(restored.payments ?? []),
          receipts: sealFinancialCollection(restored.receipts ?? []),
          quotations: sealQuotationCollection(restored.quotations ?? []),
          notifications: sealNotificationCollection(restored.notifications ?? []),
        };
      },
    }
  )
);

type PublicAppState = Omit<AppState, 'business' | 'customers' | 'items' | 'invoices' | 'payments' | 'receipts' | 'quotations' | 'settings' | 'paymentMethods' | 'notifications'> & {
  readonly business: DeepReadonly<Business> | null;
  readonly settings: DeepReadonly<AppSettings>;
  readonly paymentMethods: ReadonlyArray<DeepReadonly<PaymentMethod>>;
  readonly customers: ReadonlyArray<DeepReadonly<Customer>>;
  readonly items: ReadonlyArray<DeepReadonly<Item>>;
  readonly invoices: ReadonlyArray<DeepReadonly<Invoice>>;
  readonly payments: ReadonlyArray<DeepReadonly<PaymentRecord>>;
  readonly receipts: ReadonlyArray<DeepReadonly<Receipt>>;
  readonly quotations: ReadonlyArray<DeepReadonly<Quotation>>;
  readonly notifications: ReadonlyArray<DeepReadonly<Notification>>;
};

const identitySelector = (state: AppState): PublicAppState => state as unknown as PublicAppState;

export function useStore(): PublicAppState;
export function useStore<T>(selector: (state: PublicAppState) => T): T;
export function useStore<T>(selector?: (state: PublicAppState) => T): PublicAppState | T {
  if (!selector) return useZustandStore(appStore, identitySelector);
  return useZustandStore(appStore, (state) => selector(state as unknown as PublicAppState));
}

export function useOnlineStatus() {
  const setIsOnline = useStore((s) => s.setIsOnline);
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);
}
