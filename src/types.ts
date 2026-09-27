export type InvoicePaymentTerm = 'due_on_receipt' | '7_days' | '14_days' | '30_days';

export interface DocumentSettings {
  invoicePrefix: string;
  quotationPrefix: string;
  receiptPrefix: string;
  defaultInvoicePaymentTerms: InvoicePaymentTerm;
  defaultQuotationValidityDays: number;
  showBusinessLogo: boolean;
  showBusinessTpin: boolean;
  showCustomerTpin: boolean;
  showPaymentDetails: boolean;
  showPaidStamp: boolean;
}

export interface FinancialSettings {
  defaultTaxRate: number;
  defaultTaxInclusive: boolean;
}

export interface AppSettings {
  document: DocumentSettings;
  financial: FinancialSettings;
}

export interface Business {
  id: string;
  name: string;
  type: string;
  tpin: string;
  registrationNumber: string;
  phone: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  country: string;
  currency: string;
  logo: string;
  slogan: string;
  taxRegNumber: string;
  additionalIdentifier: string;
}

export interface PaymentMethod {
  id: string;
  businessId: string;
  type: 'cash' | 'bank_transfer' | 'mtn_money' | 'airtel_money' | 'zamtel_money' | 'card' | 'cheque' | 'other';
  provider?: string;
  phoneNumber?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
  swiftCode?: string;
}

export interface Customer {
  id: string;
  type: 'individual' | 'business';
  name: string;
  businessName: string;
  phone: string;
  email: string;
  tpin: string;
  address: string;
  townCity: string;
  country: string;
  notes: string;
  createdAt: number;
  outstandingBalance: number;
}

export interface Item {
  id: string;
  type: 'product' | 'service';
  name: string;
  description: string;
  sku: string;
  unit: string;
  price: number;
  currency: string;
  tax: number;
  taxInclusive: boolean;
  costPrice: number;
  stockQuantity: number;
  barcode: string;
  createdAt: number;
}

export interface InvoiceItem {
  itemId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  taxInclusive?: boolean;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTpin: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  issueDate: number;
  dueDate: number;
  referenceNumber: string;
  purchaseOrderNumber: string;
  paymentTerms: string;
  paymentMethods: string[];
  notes: string;
  terms: string;
  attachment: string;
  status: 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  cancelledAt?: number;
}

export interface Receipt {
  id: string;
  number: string;
  date: number;
  receivedFrom: string;
  customerId: string;
  customerName: string;
  amountReceived: number;
  paymentMethod: string;
  referenceNumber: string;
  paymentFor: string;
  linkedInvoiceId: string;
  paymentId?: string;
  notes: string;
  status?: 'active' | 'voided';
  voidedAt?: number;
  voidReason?: string;
  createdAt: number;
}

export interface Quotation {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTpin?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  issueDate: number;
  expiryDate: number;
  notes: string;
  terms: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  convertedInvoiceId?: string;
  convertedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: number;
  method: string;
  referenceNumber: string;
  notes: string;
  receiptId: string;
  status?: 'active' | 'reversed';
  reversedAt?: number;
  reversalReason?: string;
  reversalNotes?: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  date: number;
  read: boolean;
}
