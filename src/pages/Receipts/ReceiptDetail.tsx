import {useState} from 'react';
import {toast} from 'react-hot-toast';
import {useNavigate, useParams} from 'react-router-dom';
import {FiArrowLeft, FiCreditCard, FiFileText, FiHash, FiLink, FiRotateCcw, FiSlash, FiUser} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, formatDate, formatDateTime, getPaymentMethodLabel, isPaymentReversed, isReceiptVoided} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import {createReceiptPdf, downloadPdf, receiptPdfFilename, shareReceiptPdf} from '../../utils/documentPdf';
import DocumentCommunicationActions from '../../components/DocumentCommunicationActions';

export default function ReceiptDetail() {
  const navigate = useNavigate();
  const {id} = useParams();
  const {receipts, payments, invoices, business, settings, reversePayment, voidReceipt} = useStore();
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const receipt = receipts.find((item) => item.id === id);

  if (!receipt) return <EmptyState title="Receipt not found" description="This receipt may have been deleted." />;

  const linkedPayment = payments.find((payment) => payment.id === receipt.paymentId || payment.receiptId === receipt.id);
  const linkedInvoice = receipt.linkedInvoiceId ? invoices.find((invoice) => invoice.id === receipt.linkedInvoiceId) : undefined;
  const voided = isReceiptVoided(receipt);
  const paymentReversed = linkedPayment ? isPaymentReversed(linkedPayment) : false;
  const currency = business?.currency || 'ZMW';

  const downloadReceiptPdf = () => downloadPdf(createReceiptPdf({receipt, business, linkedInvoice, settings}), receiptPdfFilename(receipt));

  const confirmCorrection = (reason: string) => {
    if (linkedPayment && !paymentReversed) {
      const result = reversePayment({paymentId: linkedPayment.id, reason});
      if (!result.success) {toast.error(result.error ?? 'Payment could not be reversed.'); return;}
      toast.success('Payment reversed and receipt voided.');
    } else {
      const result = voidReceipt({receiptId: receipt.id, reason});
      if (!result.success) {toast.error(result.error ?? 'Receipt could not be voided.'); return;}
      toast.success('Receipt voided.');
    }
    setCorrectionOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={() => navigate('/receipts')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><FiArrowLeft /> Back to receipts</button>

      <section className={`mb-5 overflow-hidden rounded-2xl border bg-white shadow-soft ${voided ? 'border-rose-200' : 'border-slate-200'}`}>
        <div className={`flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6 ${voided ? 'bg-rose-50/40' : 'bg-gradient-to-r from-emerald-50/50 via-white to-white'}`}>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Receipt</p><StatusBadge status={voided ? 'voided' : 'active'} /></div><h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-950 break-anywhere">{receipt.number}</h1><p className="mt-1 text-sm text-slate-500">Issued {formatDate(receipt.date)}</p></div>
          <div className="sm:text-right"><p className={`text-3xl font-bold tracking-[-0.03em] ${voided ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>{formatCurrency(receipt.amountReceived, currency)}</p><p className="mt-1 text-xs text-slate-400">Amount received</p><div className="mt-3 flex sm:justify-end"><DocumentCommunicationActions compact document={{type: 'Receipt', number: receipt.number, customerName: receipt.receivedFrom || receipt.customerName, amount: receipt.amountReceived, currency, status: voided ? 'voided' : 'active', recordPath: `/receipts/${receipt.id}`}} onSharePdf={() => shareReceiptPdf({receipt, business, linkedInvoice, settings})} onDownloadPdf={downloadReceiptPdf} /></div></div>
        </div>
      </section>

      {voided && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-center gap-2 font-semibold text-rose-800"><FiSlash /> Voided receipt</div><p className="mt-1 text-sm text-rose-700">{receipt.voidReason || 'This receipt is retained for audit history and should not be treated as an active payment record.'}</p>{receipt.voidedAt && <p className="mt-2 text-xs font-medium text-rose-500">Voided {formatDateTime(receipt.voidedAt)}</p>}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
          <h2 className="ui-section-title">Receipt details</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[{icon: FiUser, label: 'Received from', value: receipt.receivedFrom || receipt.customerName}, {icon: FiCreditCard, label: 'Payment method', value: getPaymentMethodLabel(receipt.paymentMethod)}, {icon: FiHash, label: 'Reference', value: receipt.referenceNumber || 'Not provided'}, {icon: FiFileText, label: 'Payment for', value: receipt.paymentFor || 'Payment'}].map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm"><item.icon /></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-1 text-sm font-semibold text-slate-900 break-anywhere">{item.value}</p></div></div></div>)}
          </div>
          {receipt.notes && <div className="mt-5 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-800">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 break-anywhere">{receipt.notes}</p></div>}
        </section>

        <div className="space-y-5">
          {linkedInvoice && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiLink /></span><div><h2 className="font-bold text-slate-950">Linked invoice</h2><p className="text-xs text-slate-500">Payment relationship</p></div></div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-900">{linkedInvoice.number}</p><p className="mt-1 text-xs text-slate-500 break-anywhere">{linkedInvoice.customerName}</p><div className="mt-3 flex justify-between text-sm"><span className="text-slate-500">Invoice total</span><span className="font-semibold text-slate-800">{formatCurrency(linkedInvoice.grandTotal, currency)}</span></div></div><button type="button" onClick={() => navigate(`/invoices/${linkedInvoice.id}`)} className="ui-secondary-button mt-3 w-full"><FiFileText /> View Invoice</button></section>}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h2 className="ui-section-title">Audit information</h2><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Created</span><span className="text-right font-medium text-slate-800">{formatDateTime(receipt.createdAt)}</span></div>{linkedPayment && <div className="flex justify-between gap-3"><span className="text-slate-500">Payment status</span><StatusBadge status={paymentReversed ? 'voided' : 'active'} label={paymentReversed ? 'Reversed' : 'Active'} /></div>}</div>{!voided && <button type="button" onClick={() => setCorrectionOpen(true)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"><FiRotateCcw /> {linkedPayment && !paymentReversed ? 'Reverse payment & void receipt' : 'Void receipt'}</button>}</section>
        </div>
      </div>

      <ConfirmDialog open={correctionOpen} title={linkedPayment && !paymentReversed ? 'Reverse this payment?' : 'Void this receipt?'} description={linkedPayment && !paymentReversed ? 'The payment will be reversed, the invoice balance restored and this receipt kept as voided audit history.' : 'The receipt will remain in the audit history but will no longer be treated as active.'} confirmLabel={linkedPayment && !paymentReversed ? 'Reverse & Void' : 'Void Receipt'} reasonLabel="Reason for correction" reasonPlaceholder="Explain why this transaction is being corrected..." reasonRequired onCancel={() => setCorrectionOpen(false)} onConfirm={confirmCorrection} />
    </div>
  );
}
