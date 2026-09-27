export type CommunicableDocumentType = 'Invoice' | 'Quotation' | 'Receipt';

export interface DocumentCommunicationInput {
  type: CommunicableDocumentType;
  number: string;
  customerName?: string;
  amount?: number;
  currency?: string;
  status?: string;
  recordPath: string;
}

function safeText(value: string | undefined | null): string {
  return (value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function moneyLabel(amount: number, currency: string): string {
  return `${safeText(currency || 'ZMW')} ${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function localRecordUrl(recordPath: string): string {
  const path = recordPath.startsWith('/') ? recordPath : `/${recordPath}`;
  if (typeof window === 'undefined' || !window.location?.origin || window.location.origin === 'null') return path;
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
}

export function buildDocumentCommunicationText(input: DocumentCommunicationInput): string {
  const lines = [`${input.type} ${safeText(input.number)}`];
  const customerName = safeText(input.customerName);
  const status = safeText(input.status);
  if (customerName) lines.push(`Customer: ${customerName}`);
  if (typeof input.amount === 'number' && Number.isFinite(input.amount)) lines.push(`Amount: ${moneyLabel(input.amount, input.currency || 'ZMW')}`);
  if (status) lines.push(`Status: ${status}`);
  lines.push(`Local app link: ${localRecordUrl(input.recordPath)}`);
  return lines.join('\n');
}

export function documentEmailSubject(input: DocumentCommunicationInput): string {
  return `${input.type} ${safeText(input.number)}`;
}

export function openWhatsAppDraft(input: DocumentCommunicationInput): boolean {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return false;
  const url = `https://wa.me/?text=${encodeURIComponent(buildDocumentCommunicationText(input))}`;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  return opened !== null;
}

export function openEmailDraft(input: DocumentCommunicationInput): void {
  if (typeof window === 'undefined') return;
  const subject = encodeURIComponent(documentEmailSubject(input));
  const body = encodeURIComponent(buildDocumentCommunicationText(input));
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function copyWithTextarea(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the synchronous browser fallback.
    }
  }
  return copyWithTextarea(text);
}

export async function copyDocumentDetails(input: DocumentCommunicationInput): Promise<boolean> {
  return copyText(buildDocumentCommunicationText(input));
}

export async function copyLocalRecordLink(recordPath: string): Promise<boolean> {
  return copyText(localRecordUrl(recordPath));
}
