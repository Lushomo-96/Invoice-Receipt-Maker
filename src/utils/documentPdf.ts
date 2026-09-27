import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppSettings, Business, Invoice, PaymentMethod, Quotation, Receipt } from '../types';
import { calculateTotals, getInvoiceStatus, getPaymentMethodLabel, getQuotationStatus, isReceiptVoided } from './helpers';
import { DEFAULT_APP_SETTINGS } from './settings';

type PdfDocument = jsPDF & { lastAutoTable?: { finalY?: number } };
type DeepReadonly<T> = T extends readonly (infer U)[] ? ReadonlyArray<DeepReadonly<U>> : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
type PdfBusiness = DeepReadonly<Business>;
type PdfSettings = DeepReadonly<AppSettings>;
type PdfInvoice = DeepReadonly<Invoice>;
type PdfPaymentMethod = DeepReadonly<PaymentMethod>;
type PdfQuotation = DeepReadonly<Quotation>;
type PdfReceipt = DeepReadonly<Receipt>;

interface CommonPdfInput {
  business: PdfBusiness | null;
  settings?: PdfSettings;
}

export interface InvoicePdfInput extends CommonPdfInput {
  invoice: PdfInvoice;
  paymentMethods?: readonly PdfPaymentMethod[];
}

export interface QuotationPdfInput extends CommonPdfInput {
  quotation: PdfQuotation;
}

export interface ReceiptPdfInput extends CommonPdfInput {
  receipt: PdfReceipt;
  linkedInvoice?: PdfInvoice;
}

const PAGE_MARGIN = 14;
const PAGE_RIGHT = 196;
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_MARGIN;
const PAGE_BOTTOM = 282;
const CONTINUATION_TOP = 18;
const HEADER_LEFT_WIDTH = 105;
const HEADER_RIGHT_X = 123;
const HEADER_RIGHT_WIDTH = PAGE_RIGHT - HEADER_RIGHT_X;

function cleanPdfText(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '-')
    .replace(/…/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
}

function money(amount: number, currency: string): string {
  const safeCurrency = cleanPdfText(currency || 'ZMW');
  const formatted = amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${safeCurrency} ${formatted}`;
}

function dateLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-ZM', { year: 'numeric', month: 'short', day: 'numeric' });
}

function dateTimeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-ZM', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function slug(value: string): string {
  const cleaned = cleanPdfText(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const bounded = cleaned.slice(0, 120).replace(/[._-]+$/g, '');
  return bounded || 'document';
}

function currencyFor(business: PdfBusiness | null): string {
  return business?.currency?.trim() || 'ZMW';
}

function documentSettings(settings: PdfSettings | undefined): PdfSettings['document'] {
  return settings?.document ?? DEFAULT_APP_SETTINGS.document;
}

function businessAddress(business: PdfBusiness | null): string[] {
  if (!business) return [];
  return [business.addressLine1, business.addressLine2, business.townCity, business.country]
    .map((part) => cleanPdfText(part).trim())
    .filter(Boolean);
}

function splitUnbrokenToken(doc: jsPDF, token: string, width: number): string[] {
  if (!token || doc.getTextWidth(token) <= width) return [token];
  const chunks: string[] = [];
  let chunk = '';
  for (const character of token) {
    const candidate = chunk + character;
    if (chunk && doc.getTextWidth(candidate) > width) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

/**
 * Width-aware text wrapping that also handles URLs, identifiers, reference
 * numbers, and other long tokens that contain no spaces. The active jsPDF
 * font/font-size are used for measurement.
 */
function wrapPdfText(doc: jsPDF, value: string, width: number): string[] {
  const text = cleanPdfText(value);
  if (!text) return [];
  const output: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      output.push('');
      continue;
    }

    const tokens = paragraph.trim().split(/\s+/).flatMap((token) => splitUnbrokenToken(doc, token, width));
    let line = '';
    for (const token of tokens) {
      const candidate = line ? `${line} ${token}` : token;
      if (line && doc.getTextWidth(candidate) > width) {
        output.push(line);
        line = token;
      } else {
        line = candidate;
      }
    }
    if (line) output.push(line);
  }

  return output;
}

function fitFontSize(doc: jsPDF, text: string, width: number, preferred: number, minimum = 6): number {
  const safeText = cleanPdfText(text);
  for (let size = preferred; size >= minimum; size -= 0.5) {
    doc.setFontSize(size);
    if (doc.getTextWidth(safeText) <= width) return size;
  }
  doc.setFontSize(minimum);
  return minimum;
}

function addBusinessIdentity(doc: jsPDF, business: PdfBusiness | null, settings?: PdfSettings): number {
  const display = documentSettings(settings);
  const name = cleanPdfText(business?.name || 'Business');
  let textX = PAGE_MARGIN;
  let textWidth = HEADER_LEFT_WIDTH;
  let logoBottom = 0;

  if (display.showBusinessLogo && business?.logo?.startsWith('data:image/')) {
    try {
      const imageFormat = business.logo.startsWith('data:image/jpeg') || business.logo.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
      const props = doc.getImageProperties(business.logo);
      const maxWidth = 20;
      const maxHeight = 20;
      const ratio = props.width > 0 && props.height > 0 ? props.width / props.height : 1;
      const drawWidth = ratio >= 1 ? maxWidth : maxHeight * ratio;
      const drawHeight = ratio >= 1 ? maxWidth / ratio : maxHeight;
      const logoX = PAGE_MARGIN + (maxWidth - drawWidth) / 2;
      const logoY = 10 + (maxHeight - drawHeight) / 2;
      doc.addImage(business.logo, imageFormat, logoX, logoY, drawWidth, drawHeight);
      textX = 39;
      textWidth = HEADER_LEFT_WIDTH - (textX - PAGE_MARGIN);
      logoBottom = 30;
    } catch {
      textX = PAGE_MARGIN;
      textWidth = HEADER_LEFT_WIDTH;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const nameLines = wrapPdfText(doc, name, textWidth);
  doc.text(nameLines.length > 0 ? nameLines : ['Business'], textX, 16, { lineHeightFactor: 1.1 });
  let y = 16 + Math.max(1, nameLines.length) * 5.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(90);
  const contactLine = [
    business?.phone ? `Tel: ${cleanPdfText(business.phone)}` : '',
    business?.email ? cleanPdfText(business.email) : '',
  ].filter(Boolean).join(' | ');
  const rawLines = [
    businessAddress(business).join(', '),
    contactLine,
    display.showBusinessTpin && business?.tpin ? `TPIN: ${cleanPdfText(business.tpin)}` : '',
  ].filter(Boolean);

  for (const rawLine of rawLines) {
    const lines = wrapPdfText(doc, rawLine, textWidth);
    if (lines.length > 0) {
      doc.text(lines, textX, y, { lineHeightFactor: 1.15 });
      y += lines.length * 3.8;
    }
  }
  doc.setTextColor(0);
  return Math.max(y, logoBottom);
}

function addDocumentTitle(doc: jsPDF, title: string, number: string, status: string): number {
  let y = 17;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const titleLines = wrapPdfText(doc, cleanPdfText(title).toUpperCase(), HEADER_RIGHT_WIDTH);
  doc.text(titleLines, PAGE_RIGHT, y, { align: 'right', lineHeightFactor: 1.1 });
  y += Math.max(1, titleLines.length) * 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const numberLines = wrapPdfText(doc, cleanPdfText(number), HEADER_RIGHT_WIDTH);
  doc.text(numberLines.length > 0 ? numberLines : ['-'], PAGE_RIGHT, y, { align: 'right', lineHeightFactor: 1.15 });
  y += Math.max(1, numberLines.length) * 4.2;

  doc.setFontSize(8.2);
  const statusLines = wrapPdfText(doc, `Status: ${cleanPdfText(status).toUpperCase()}`, HEADER_RIGHT_WIDTH);
  doc.text(statusLines, PAGE_RIGHT, y, { align: 'right', lineHeightFactor: 1.15 });
  y += Math.max(1, statusLines.length) * 3.8;
  return y;
}

function addDocumentHeader(doc: jsPDF, business: PdfBusiness | null, title: string, number: string, status: string, settings?: PdfSettings): number {
  const leftBottom = addBusinessIdentity(doc, business, settings);
  const rightBottom = addDocumentTitle(doc, title, number, status);
  const separatorY = Math.max(40, leftBottom + 4, rightBottom + 4);
  doc.setDrawColor(220);
  doc.line(PAGE_MARGIN, separatorY, PAGE_RIGHT, separatorY);
  return separatorY;
}

function addKeyValue(doc: jsPDF, label: string, value: string, x: number, y: number, width = 60): number {
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.setFont('helvetica', 'normal');
  const labelLines = wrapPdfText(doc, cleanPdfText(label).toUpperCase(), width);
  doc.text(labelLines, x, y, { lineHeightFactor: 1.1 });
  const valueY = y + Math.max(1, labelLines.length) * 3.4 + 1.2;

  doc.setFontSize(9.2);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  const lines = wrapPdfText(doc, cleanPdfText(value || '-'), width);
  doc.text(lines.length > 0 ? lines : ['-'], x, valueY, { lineHeightFactor: 1.18 });
  return valueY + Math.max(1, lines.length) * 4;
}

function addFlowKeyValue(doc: jsPDF, label: string, value: string, y: number): number {
  const safeValue = cleanPdfText(value || '-');
  let currentY = ensureSpace(doc, y, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110);
  const labelLines = wrapPdfText(doc, cleanPdfText(label).toUpperCase(), CONTENT_WIDTH);
  doc.text(labelLines, PAGE_MARGIN, currentY, { lineHeightFactor: 1.1 });
  currentY += Math.max(1, labelLines.length) * 3.4 + 1.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(0);
  let remaining = wrapPdfText(doc, safeValue, CONTENT_WIDTH);
  if (remaining.length === 0) remaining = ['-'];
  let continued = false;

  while (remaining.length > 0) {
    const lineHeight = 4;
    const availableLines = Math.floor((PAGE_BOTTOM - currentY) / lineHeight);
    if (availableLines <= 0) {
      doc.addPage();
      currentY = CONTINUATION_TOP;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(`${cleanPdfText(label).toUpperCase()} (CONTINUED)`, PAGE_MARGIN, currentY);
      currentY += 4.6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);
      doc.setTextColor(0);
      continued = true;
      continue;
    }
    const chunk = remaining.splice(0, availableLines);
    doc.text(chunk, PAGE_MARGIN, currentY, { lineHeightFactor: 1.18 });
    currentY += chunk.length * lineHeight;
    if (remaining.length > 0) {
      doc.addPage();
      currentY = CONTINUATION_TOP;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(`${cleanPdfText(label).toUpperCase()} (CONTINUED)`, PAGE_MARGIN, currentY);
      currentY += 4.6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);
      doc.setTextColor(0);
      continued = true;
    }
  }

  if (continued) doc.setTextColor(0);
  return currentY + 3;
}

function addMutedLines(doc: jsPDF, values: readonly string[], x: number, y: number, width: number): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.setTextColor(80);
  let nextY = y;
  for (const value of values) {
    const lines = wrapPdfText(doc, value, width);
    if (lines.length === 0) continue;
    doc.text(lines, x, nextY, { lineHeightFactor: 1.2 });
    nextY += lines.length * 3.7;
  }
  doc.setTextColor(0);
  return nextY;
}

function ensureSpace(doc: jsPDF, y: number, requiredHeight: number): number {
  if (y + requiredHeight <= PAGE_BOTTOM) return y;
  doc.addPage();
  return CONTINUATION_TOP;
}

function addSectionText(doc: jsPDF, title: string, text: string, y: number): number {
  const body = cleanPdfText(text).trim();
  if (!body) return y;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const lines = wrapPdfText(doc, body, CONTENT_WIDTH);
  let remaining = [...lines];
  let currentY = ensureSpace(doc, y, 13);
  let firstPage = true;

  while (remaining.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const heading = firstPage ? cleanPdfText(title) : `${cleanPdfText(title)} (continued)`;
    const headingLines = wrapPdfText(doc, heading, CONTENT_WIDTH);
    doc.text(headingLines, PAGE_MARGIN, currentY, { lineHeightFactor: 1.1 });
    currentY += Math.max(1, headingLines.length) * 4 + 1.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70);
    const lineHeight = 3.8;
    const availableLines = Math.max(1, Math.floor((PAGE_BOTTOM - currentY) / lineHeight));
    const chunk = remaining.splice(0, availableLines);
    doc.text(chunk, PAGE_MARGIN, currentY, { lineHeightFactor: 1.2 });
    currentY += chunk.length * lineHeight;
    doc.setTextColor(0);

    if (remaining.length > 0) {
      doc.addPage();
      currentY = CONTINUATION_TOP;
      firstPage = false;
    }
  }

  return currentY + 3;
}

function addContinuationHeaders(doc: jsPDF, documentType: string, number: string): void {
  const pages = doc.getNumberOfPages();
  for (let page = 2; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(cleanPdfText(documentType).toUpperCase(), PAGE_MARGIN, 8.5);

    doc.setFont('helvetica', 'normal');
    const numberText = cleanPdfText(number);
    fitFontSize(doc, numberText, 105, 7.5, 5.5);
    const numberLines = wrapPdfText(doc, numberText, 105);
    doc.text(numberLines.slice(0, 1), PAGE_RIGHT, 8.5, { align: 'right' });
    doc.setDrawColor(232);
    doc.line(PAGE_MARGIN, 11.5, PAGE_RIGHT, 11.5);
    doc.setTextColor(0);
  }
}

function addPageFooters(doc: jsPDF, label: string): void {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(225);
    doc.line(PAGE_MARGIN, 287, PAGE_RIGHT, 287);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.setFontSize(7.5);
    const footerLabel = wrapPdfText(doc, cleanPdfText(label), 135)[0] || 'Document';
    doc.text(footerLabel, PAGE_MARGIN, 291);
    doc.text(`Page ${page} of ${pages}`, PAGE_RIGHT, 291, { align: 'right' });
    doc.setTextColor(0);
  }
}

function addStatusNotice(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  const lines = wrapPdfText(doc, cleanPdfText(text), CONTENT_WIDTH - 12);
  const height = Math.max(10, 5 + Math.max(1, lines.length) * 4);
  const startY = ensureSpace(doc, y, height + 2);
  doc.setDrawColor(180);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(PAGE_MARGIN, startY, CONTENT_WIDTH, height, 2, 2, 'FD');
  doc.text(lines.length > 0 ? lines : [''], 105, startY + 5.8, { align: 'center', lineHeightFactor: 1.15 });
  return startY + height + 4;
}

function tableEndY(doc: PdfDocument, fallback: number): number {
  return doc.lastAutoTable?.finalY ?? fallback;
}

function selectedPaymentMethods(invoice: PdfInvoice, methods: readonly PdfPaymentMethod[]): string[] {
  if (invoice.paymentMethods.length === 0 || methods.length === 0) return [];
  return invoice.paymentMethods
    .map((id) => methods.find((method) => method.id === id))
    .filter((method): method is PdfPaymentMethod => Boolean(method))
    .map((method) => {
      const parts = [getPaymentMethodLabel(method.type)];
      if (method.provider) parts.push(cleanPdfText(method.provider));
      if (method.bankName) parts.push(cleanPdfText(method.bankName));
      if (method.accountName) parts.push(cleanPdfText(method.accountName));
      if (method.accountNumber) parts.push(`A/C ${cleanPdfText(method.accountNumber)}`);
      if (method.branch) parts.push(`Branch ${cleanPdfText(method.branch)}`);
      if (method.swiftCode) parts.push(`SWIFT ${cleanPdfText(method.swiftCode)}`);
      if (method.phoneNumber) parts.push(cleanPdfText(method.phoneNumber));
      const seen = new Set<string>();
      return parts
        .map((part) => part.trim())
        .filter((part) => {
          const key = part.toLowerCase();
          if (!part || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .join(' - ');
    });
}

function itemCellText(doc: jsPDF, name: string, description: string): string {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const combined = cleanPdfText(description ? `${name}\n${description}` : name);
  return wrapPdfText(doc, combined, 61).join('\n');
}

function addTotalsRows(doc: jsPDF, rows: ReadonlyArray<readonly [string, string, boolean]>, y: number): number {
  let currentY = y;
  const labelX = 119;
  const labelWidth = 31;
  const valueWidth = 44;

  for (const [label, value, bold] of rows) {
    currentY = ensureSpace(doc, currentY, bold ? 7 : 6);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 8.5);
    const labelLines = wrapPdfText(doc, label, labelWidth);
    doc.text(labelLines, labelX, currentY, { lineHeightFactor: 1.1 });

    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const preferredSize = bold ? 10 : 8.5;
    const valueSize = fitFontSize(doc, value, valueWidth, preferredSize, 6.5);
    const valueLines = wrapPdfText(doc, value, valueWidth);
    doc.setFontSize(valueSize);
    doc.text(valueLines, PAGE_RIGHT, currentY, { align: 'right', lineHeightFactor: 1.1 });
    const rowLines = Math.max(1, labelLines.length, valueLines.length);
    currentY += rowLines * (bold ? 4.8 : 4.2) + 1.2;
  }
  return currentY;
}

function addDocumentChrome(doc: jsPDF, documentType: string, number: string): void {
  addContinuationHeaders(doc, documentType, number);
  addPageFooters(doc, `${documentType}: ${number}`);
}

export function createInvoicePdf({ invoice, business, paymentMethods = [], settings }: InvoicePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as PdfDocument;
  const currency = currencyFor(business);
  const status = getInvoiceStatus(invoice);
  const totals = calculateTotals(invoice.items);
  const display = documentSettings(settings);

  const headerBottom = addDocumentHeader(doc, business, 'Invoice', invoice.number, status, settings);
  const detailsY = headerBottom + 8;

  let leftBottom = addKeyValue(doc, 'Bill to', invoice.customerName || '-', PAGE_MARGIN, detailsY, 99);
  const customerLines = [
    invoice.customerAddress,
    invoice.customerPhone,
    display.showCustomerTpin && invoice.customerTpin ? `TPIN: ${invoice.customerTpin}` : '',
  ].map(cleanPdfText).filter(Boolean);
  leftBottom = addMutedLines(doc, customerLines, PAGE_MARGIN, leftBottom + 1, 99);

  const issueBottom = addKeyValue(doc, 'Issue date', dateLabel(invoice.issueDate), 125, detailsY, 32);
  const dueBottom = addKeyValue(doc, 'Due date', dateLabel(invoice.dueDate), 163, detailsY, 33);
  let referenceBottom = issueBottom;
  let poBottom = dueBottom;
  if (invoice.referenceNumber) referenceBottom = addKeyValue(doc, 'Reference', invoice.referenceNumber, 125, issueBottom + 4, 32);
  if (invoice.purchaseOrderNumber) poBottom = addKeyValue(doc, 'PO number', invoice.purchaseOrderNumber, 163, dueBottom + 4, 33);

  const tableStart = Math.max(leftBottom, referenceBottom, poBottom) + 7;
  autoTable(doc, {
    startY: tableStart,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: CONTINUATION_TOP, bottom: 18 },
    head: [['Item', 'Qty', 'Unit price', 'Discount', 'Tax', 'Amount']],
    body: invoice.items.map((item) => [
      itemCellText(doc, item.name, item.description),
      String(item.quantity),
      money(item.unitPrice, currency),
      item.discount > 0 ? money(item.discount, currency) : '-',
      item.tax > 0 ? `${item.tax}%${item.taxInclusive ? ' incl.' : ''}` : '-',
      money(item.amount, currency),
    ]),
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 65 }, 1: { halign: 'right', cellWidth: 15 }, 2: { halign: 'right', cellWidth: 27 },
      3: { halign: 'right', cellWidth: 25 }, 4: { halign: 'right', cellWidth: 20 }, 5: { halign: 'right', cellWidth: 30 },
    },
  });

  let y = tableEndY(doc, tableStart + 20) + 7;
  y = ensureSpace(doc, y, 42);
  const rows: Array<readonly [string, string, boolean]> = [
    ['Subtotal', money(invoice.subtotal, currency), false],
  ];
  if (totals.totalDiscount > 0) rows.push(['Line discounts', `- ${money(totals.totalDiscount, currency)}`, false]);
  if (invoice.discount > 0) rows.push(['Invoice discount', `- ${money(invoice.discount, currency)}`, false]);
  if (totals.addedTax > 0) rows.push(['Tax added', money(totals.addedTax, currency), false]);
  if (totals.includedTax > 0) rows.push(['Tax included', money(totals.includedTax, currency), false]);
  if (invoice.shipping > 0) rows.push(['Shipping', money(invoice.shipping, currency), false]);
  rows.push(['Total', money(invoice.grandTotal, currency), true]);
  if (invoice.amountPaid > 0) rows.push(['Paid', money(invoice.amountPaid, currency), false]);
  rows.push(['Balance due', money(invoice.balanceDue, currency), true]);
  y = addTotalsRows(doc, rows, y);

  if (status === 'paid' && display.showPaidStamp) y = addStatusNotice(doc, 'PAID IN FULL', y + 2);
  if (status === 'cancelled') y = addStatusNotice(doc, `CANCELLED${invoice.cancelledAt ? ` - ${dateTimeLabel(invoice.cancelledAt)}` : ''}`, y + 2);

  if (invoice.paymentTerms) y = addSectionText(doc, 'Payment terms', invoice.paymentTerms.replace(/_/g, ' '), y + 3);
  const methodLines = display.showPaymentDetails ? selectedPaymentMethods(invoice, paymentMethods) : [];
  if (methodLines.length > 0) y = addSectionText(doc, 'Payment details', methodLines.join('\n'), y + 2);
  if (invoice.notes) y = addSectionText(doc, 'Notes', invoice.notes, y + 2);
  if (invoice.terms) addSectionText(doc, 'Terms & Conditions', invoice.terms, y + 2);

  addDocumentChrome(doc, 'Invoice', invoice.number);
  return doc;
}

export function createQuotationPdf({ quotation, business, settings }: QuotationPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as PdfDocument;
  const currency = currencyFor(business);
  const status = getQuotationStatus(quotation);
  const totals = calculateTotals(quotation.items);
  const display = documentSettings(settings);

  const headerBottom = addDocumentHeader(doc, business, 'Quotation', quotation.number, status, settings);
  const detailsY = headerBottom + 8;
  let leftBottom = addKeyValue(doc, 'Prepared for', quotation.customerName || '-', PAGE_MARGIN, detailsY, 99);
  const customerLines = [
    quotation.customerAddress || '',
    quotation.customerPhone || '',
    display.showCustomerTpin && quotation.customerTpin ? `TPIN: ${quotation.customerTpin}` : '',
  ].map(cleanPdfText).filter(Boolean);
  leftBottom = addMutedLines(doc, customerLines, PAGE_MARGIN, leftBottom + 1, 99);

  const issueBottom = addKeyValue(doc, 'Issue date', dateLabel(quotation.issueDate), 125, detailsY, 32);
  const expiryBottom = addKeyValue(doc, 'Valid until', dateLabel(quotation.expiryDate), 163, detailsY, 33);
  const tableStart = Math.max(leftBottom, issueBottom, expiryBottom) + 7;

  autoTable(doc, {
    startY: tableStart,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: CONTINUATION_TOP, bottom: 18 },
    head: [['Item', 'Qty', 'Unit price', 'Discount', 'Tax', 'Amount']],
    body: quotation.items.map((item) => [
      itemCellText(doc, item.name, item.description),
      String(item.quantity),
      money(item.unitPrice, currency),
      item.discount > 0 ? money(item.discount, currency) : '-',
      item.tax > 0 ? `${item.tax}%${item.taxInclusive ? ' incl.' : ''}` : '-',
      money(item.amount, currency),
    ]),
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 65 }, 1: { halign: 'right', cellWidth: 15 }, 2: { halign: 'right', cellWidth: 27 },
      3: { halign: 'right', cellWidth: 25 }, 4: { halign: 'right', cellWidth: 20 }, 5: { halign: 'right', cellWidth: 30 },
    },
  });

  let y = tableEndY(doc, tableStart + 20) + 7;
  y = ensureSpace(doc, y, 36);
  const rows: Array<readonly [string, string, boolean]> = [['Subtotal', money(quotation.subtotal, currency), false]];
  if (totals.totalDiscount > 0) rows.push(['Line discounts', `- ${money(totals.totalDiscount, currency)}`, false]);
  if (quotation.discount > 0) rows.push(['Quotation discount', `- ${money(quotation.discount, currency)}`, false]);
  if (totals.addedTax > 0) rows.push(['Tax added', money(totals.addedTax, currency), false]);
  if (totals.includedTax > 0) rows.push(['Tax included', money(totals.includedTax, currency), false]);
  rows.push(['Total', money(quotation.total, currency), true]);
  y = addTotalsRows(doc, rows, y);

  if (quotation.convertedInvoiceId) {
    y = addStatusNotice(doc, 'ACCEPTED - CONVERTED TO INVOICE', y + 2);
  } else if (status === 'expired') {
    y = addStatusNotice(doc, `EXPIRED - VALID UNTIL ${dateLabel(quotation.expiryDate)}`, y + 2);
  } else if (status === 'rejected') {
    y = addStatusNotice(doc, 'REJECTED BY CUSTOMER', y + 2);
  }
  if (quotation.notes) y = addSectionText(doc, 'Notes', quotation.notes, y + 3);
  if (quotation.terms) addSectionText(doc, 'Terms & Conditions', quotation.terms, y + 2);

  addDocumentChrome(doc, 'Quotation', quotation.number);
  return doc;
}

export function createReceiptPdf({ receipt, business, linkedInvoice, settings }: ReceiptPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const currency = currencyFor(business);
  const voided = isReceiptVoided(receipt);

  const headerBottom = addDocumentHeader(doc, business, 'Receipt', receipt.number, voided ? 'voided' : 'active', settings);
  let y = ensureSpace(doc, headerBottom + 8, 34);
  if (voided) y = addStatusNotice(doc, 'VOIDED RECEIPT - NOT VALID AS PROOF OF PAYMENT', y);

  y = ensureSpace(doc, y, 26);
  doc.setFont('helvetica', 'bold');
  const amountText = money(receipt.amountReceived, currency);
  fitFontSize(doc, amountText, CONTENT_WIDTH, 24, 12);
  const amountLines = wrapPdfText(doc, amountText, CONTENT_WIDTH);
  doc.text(amountLines, PAGE_MARGIN, y + 8, { lineHeightFactor: 1.05 });
  const amountBottom = y + 8 + Math.max(1, amountLines.length) * 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  doc.text('Amount received', PAGE_MARGIN, amountBottom + 1);
  doc.setTextColor(0);

  const detailY = amountBottom + 12;
  const dateBottom = addKeyValue(doc, 'Date', dateLabel(receipt.date), PAGE_MARGIN, detailY, 70);
  const methodBottom = addKeyValue(doc, 'Payment method', getPaymentMethodLabel(receipt.paymentMethod), 105, detailY, 91);
  let nextY = Math.max(dateBottom, methodBottom) + 7;

  nextY = addFlowKeyValue(doc, 'Received from', receipt.receivedFrom || receipt.customerName || '-', nextY);
  nextY = addFlowKeyValue(doc, 'Reference', receipt.referenceNumber || '-', nextY + 1);
  nextY = addFlowKeyValue(doc, 'Payment for', receipt.paymentFor || 'Payment', nextY + 1);
  nextY = addFlowKeyValue(doc, 'Invoice', linkedInvoice?.number || (receipt.linkedInvoiceId ? 'Linked invoice' : '-'), nextY + 1);

  if (voided && receipt.voidReason) {
    nextY = addSectionText(doc, 'Void reason', receipt.voidReason, nextY + 2);
    if (receipt.voidedAt) nextY = addSectionText(doc, 'Voided on', dateTimeLabel(receipt.voidedAt), nextY + 2);
  }
  if (receipt.notes) addSectionText(doc, 'Notes', receipt.notes, nextY + 2);

  addDocumentChrome(doc, 'Receipt', receipt.number);
  return doc;
}

export function invoicePdfFilename(invoice: PdfInvoice): string {
  return `${slug(invoice.number)}-invoice.pdf`;
}

export function quotationPdfFilename(quotation: PdfQuotation): string {
  return `${slug(quotation.number)}-quotation.pdf`;
}

export function receiptPdfFilename(receipt: PdfReceipt): string {
  return `${slug(receipt.number)}-receipt.pdf`;
}

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

async function sharePdf(doc: jsPDF, filename: string, title: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof File === 'undefined' || !navigator.share) return false;
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  try {
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: cleanPdfText(title) });
    return true;
  } catch (error) {
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') throw error;
    return false;
  }
}

export async function shareInvoicePdf(input: InvoicePdfInput): Promise<boolean> {
  return sharePdf(createInvoicePdf(input), invoicePdfFilename(input.invoice), `Invoice ${input.invoice.number}`);
}

export async function shareQuotationPdf(input: QuotationPdfInput): Promise<boolean> {
  return sharePdf(createQuotationPdf(input), quotationPdfFilename(input.quotation), `Quotation ${input.quotation.number}`);
}

export async function shareReceiptPdf(input: ReceiptPdfInput): Promise<boolean> {
  return sharePdf(createReceiptPdf(input), receiptPdfFilename(input.receipt), `Receipt ${input.receipt.number}`);
}
