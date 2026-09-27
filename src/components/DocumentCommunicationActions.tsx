import { toast } from 'react-hot-toast';
import { FiCopy, FiDownload, FiLink, FiMail, FiMessageCircle, FiShare2 } from 'react-icons/fi';
import {
  copyDocumentDetails,
  copyLocalRecordLink,
  openEmailDraft,
  openWhatsAppDraft,
  type DocumentCommunicationInput,
} from '../utils/communication';

interface DocumentCommunicationActionsProps {
  document: DocumentCommunicationInput;
  onSharePdf: () => Promise<boolean>;
  onDownloadPdf: () => void;
  compact?: boolean;
}

function isAbortError(error: unknown): boolean {
  return typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError';
}

export default function DocumentCommunicationActions({ document, onSharePdf, onDownloadPdf, compact = false }: DocumentCommunicationActionsProps) {
  const actionClass = compact
    ? 'flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
    : 'flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50';

  const fallbackDownload = (message: string) => {
    try {
      onDownloadPdf();
      toast(message);
    } catch {
      toast.error(`Unable to download the ${document.type.toLowerCase()} PDF.`);
    }
  };

  const sharePdf = async () => {
    try {
      const shared = await onSharePdf();
      if (shared) {
        toast.success(`${document.type} PDF shared.`);
        return;
      }
      fallbackDownload('Native file sharing is unavailable, so the PDF was downloaded instead.');
    } catch (error) {
      if (isAbortError(error)) return;
      fallbackDownload('Sharing failed, so the PDF was downloaded instead.');
    }
  };

  const download = () => {
    try {
      onDownloadPdf();
      toast.success(`${document.type} PDF downloaded.`);
    } catch {
      toast.error(`Unable to download the ${document.type.toLowerCase()} PDF.`);
    }
  };

  const copyDetails = async () => {
    const copied = await copyDocumentDetails(document);
    copied ? toast.success(`${document.type} details copied.`) : toast.error('Unable to copy document details.');
  };

  const copyLink = async () => {
    const copied = await copyLocalRecordLink(document.recordPath);
    copied ? toast.success('Local app link copied.') : toast.error('Unable to copy the local app link.');
  };

  const whatsapp = () => {
    if (!openWhatsAppDraft(document)) toast.error('Unable to open WhatsApp. Check your popup settings.');
  };

  const label = (text: string) => compact ? null : <span>{text}</span>;

  return (
    <div className="flex min-w-0 flex-wrap gap-2" onClick={compact ? (event) => event.stopPropagation() : undefined}>
      <button type="button" onClick={() => void sharePdf()} className={actionClass} title="Share PDF" aria-label={`Share ${document.number} PDF`}><FiShare2 />{label('Share PDF')}</button>
      <button type="button" onClick={download} className={actionClass} title="Download PDF" aria-label={`Download ${document.number} PDF`}><FiDownload />{label('Download')}</button>
      <button type="button" onClick={whatsapp} className={actionClass} title="Share details via WhatsApp" aria-label={`Share ${document.number} details via WhatsApp`}><FiMessageCircle />{label('WhatsApp')}</button>
      <button type="button" onClick={() => openEmailDraft(document)} className={actionClass} title="Create email draft" aria-label={`Create email draft for ${document.number}`}><FiMail />{label('Email')}</button>
      <button type="button" onClick={() => void copyDetails()} className={actionClass} title="Copy document details" aria-label={`Copy ${document.number} details`}><FiCopy />{label('Copy details')}</button>
      <button type="button" onClick={() => void copyLink()} className={actionClass} title="Copy local app link" aria-label={`Copy local link for ${document.number}`}><FiLink />{label('Copy link')}</button>
    </div>
  );
}
