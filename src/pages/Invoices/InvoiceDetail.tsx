import {useState} from 'react';
import {toast} from 'react-hot-toast';
import {useNavigate, useParams} from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiEdit3,
  FiFileText,
  FiRotateCcw,
  FiTrash2,
  FiUser,
  FiXCircle,
} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {cn, formatCurrency, formatDate, getInvoiceEditLockReason, getInvoiceStatus, getPaymentMethodLabel, isPaymentReversed} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import {createInvoicePdf, downloadPdf, invoicePdfFilename, shareInvoicePdf} from '../../utils/documentPdf';
import DocumentCommunicationActions from '../../components/DocumentCommunicationActions';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';

type DialogState =
  | {type: 'delete'}
  | {type: 'cancel'}
  | {type: 'reverse'; paymentId: string; amount: number}
  | null;

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const {id} = useParams();
  const {invoices, payments, receipts, business, paymentMethods, settings, deleteInvoice, cancelInvoice, reversePayment} = useStore();
  const [dialog, setDialog] = useState<DialogState>(null);
  const inv = invoices.find((invoice) => invoice.id === id);
  if (!inv) return <EmptyState title="Invoice not found" description="This invoice may have been deleted." />;

  const currency = business?.currency || 'ZMW';
  const status = getInvoiceStatus(inv);
  const paymentHistory = payments.filter((payment) => payment.invoiceId === inv.id);
  const hasPaymentHistory = paymentHistory.length > 0;
  const hasReceiptHistory = receipts.some((receipt) => receipt.linkedInvoiceId === inv.id);
  const editLockReason = getInvoiceEditLockReason(inv, hasPaymentHistory, hasReceiptHistory);

  const handleDeleteDraft = () => {
    const result = deleteInvoice(inv.id);
    if (!result.success) {
      toast.error(result.error ?? 'Unable to delete invoice.');
      return;
    }
    setDialog(null);
    toast.success('Draft invoice deleted.');
    navigate('/invoices');
  };

  const handleCancelInvoice = () => {
    const result = cancelInvoice(inv.id);
    if (!result.success) {
      toast.error(result.error ?? 'Unable to cancel invoice.');
      return;
    }
    setDialog(null);
    toast.success('Invoice cancelled.');
  };

  const downloadInvoicePdf = () => {
    const doc = createInvoicePdf({invoice: inv, business, paymentMethods, settings});
    downloadPdf(doc, invoicePdfFilename(inv));
  };

  const handleReversePayment = (reason: string) => {
    if (!dialog || dialog.type !== 'reverse') return;
    const result = reversePayment({paymentId: dialog.paymentId, reason});
    if (!result.success) {
      toast.error(result.error ?? 'Payment could not be reversed.');
      return;
    }
    setDialog(null);
    toast.success('Payment reversed. The original transaction remains in the audit history.');
  };

  const dialogProps = (() => {
    if (!dialog) return null;
    if (dialog.type === 'delete') return {
      title: 'Delete draft invoice?',
      description: `Delete ${inv.number}? This draft will be permanently removed and cannot be restored.`,
      confirmLabel: 'Delete Draft',
      onConfirm: () => handleDeleteDraft(),
      reasonRequired: false,
    };
    if (dialog.type === 'cancel') return {
      title: 'Cancel invoice?',
      description: `Cancel ${inv.number}? The invoice will remain in your records and cannot receive new payments.`,
      confirmLabel: 'Cancel Invoice',
      onConfirm: () => handleCancelInvoice(),
      reasonRequired: false,
    };
    return {
      title: 'Reverse payment?',
      description: `Reverse the ${formatCurrency(dialog.amount, currency)} payment? The invoice balance will be restored and any linked receipt will be voided.`,
      confirmLabel: 'Reverse Payment',
      onConfirm: handleReversePayment,
      reasonRequired: true,
    };
  })();

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <button type="button" onClick={() => navigate('/invoices')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><FiArrowLeft /> Back to invoices</button>

      <PageHeader
        eyebrow="Invoice"
        title={inv.number}
        description={`${inv.customerName} · Issued ${formatDate(inv.issueDate)} · Due ${formatDate(inv.dueDate)}`}
        actions={
          <>
            <button type="button" onClick={() => navigate(`/invoices/preview/${inv.id}`)} className="ui-secondary-button"><FiFileText /> Preview</button>
            {!['paid', 'cancelled', 'draft'].includes(status) && <button type="button" onClick={() => navigate(`/payments?invoice=${inv.id}`)} className="ui-primary-button"><FiCheckCircle /> Record Payment</button>}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {editLockReason && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Editing locked</span>}
      </div>

      {editLockReason && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800"><strong>Editing locked:</strong> {editLockReason}</div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Invoice total</p><p className="mt-2 text-xl font-bold text-slate-950">{formatCurrency(inv.grandTotal, currency)}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiDollarSign /></span></div></Card>
        <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Paid</p><p className="mt-2 text-xl font-bold text-emerald-600">{formatCurrency(inv.amountPaid, currency)}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FiCheckCircle /></span></div></Card>
        <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Balance due</p><p className="mt-2 text-xl font-bold text-slate-950">{formatCurrency(inv.balanceDue, currency)}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><FiClock /></span></div></Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.65fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 p-4 sm:p-5"><h2 className="text-base font-bold text-slate-950">Invoice items</h2><p className="mt-1 text-xs text-slate-500">Products and services billed on this document.</p></div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead className="bg-slate-50/80"><tr>{['Item / description', 'Quantity', 'Rate', 'Amount'].map((heading) => <th scope="col" key={heading} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{inv.items.map((item, index) => <tr key={index}><td className="px-5 py-3.5"><p className="text-sm font-semibold text-slate-900 break-anywhere">{item.name}</p>{item.description && <p className="mt-1 text-xs text-slate-400 break-anywhere">{item.description}</p>}</td><td className="px-5 py-3.5 text-sm text-slate-600">{item.quantity}</td><td className="px-5 py-3.5 text-sm text-slate-600">{formatCurrency(item.unitPrice, currency)}</td><td className="px-5 py-3.5 text-sm font-bold text-slate-950">{formatCurrency(item.amount, currency)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">{inv.items.map((item, index) => <div key={index} className="p-4"><p className="text-sm font-bold text-slate-900 break-anywhere">{item.name}</p>{item.description && <p className="mt-1 text-xs leading-5 text-slate-500 break-anywhere">{item.description}</p>}<div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-400">Qty</p><p className="mt-1 font-semibold text-slate-700">{item.quantity}</p></div><div><p className="text-slate-400">Rate</p><p className="mt-1 font-semibold text-slate-700">{formatCurrency(item.unitPrice, currency)}</p></div><div className="text-right"><p className="text-slate-400">Amount</p><p className="mt-1 font-bold text-slate-950">{formatCurrency(item.amount, currency)}</p></div></div></div>)}</div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 p-4 sm:p-5"><h2 className="text-base font-bold text-slate-950">Payment history</h2><p className="mt-1 text-xs text-slate-500">Every collection and reversal associated with this invoice.</p></div>
            {paymentHistory.length === 0 ? <EmptyState icon={<FiDollarSign className="h-7 w-7" />} title="No payments recorded" description="Payments applied to this invoice will appear here with their audit status." /> : (
              <div className="divide-y divide-slate-100">
                {paymentHistory.map((payment) => {
                  const reversed = isPaymentReversed(payment);
                  return (
                    <div key={payment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-900">{formatDate(payment.date)}</p><StatusBadge status={reversed ? 'reversed' : 'active'} /></div><p className="mt-1 text-xs text-slate-500">{getPaymentMethodLabel(payment.method)}{payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}</p>{reversed && payment.reversalReason && <p className="mt-1.5 text-xs leading-5 text-rose-600">Reason: {payment.reversalReason}</p>}</div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end"><p className={cn('font-bold text-slate-950', reversed && 'text-slate-400 line-through')}>{formatCurrency(payment.amount, currency)}</p>{!reversed && <button type="button" onClick={() => setDialog({type: 'reverse', paymentId: payment.id, amount: payment.amount})} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"><FiRotateCcw /> Reverse</button>}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiUser /></span><div><h2 className="font-bold text-slate-950">Customer</h2><p className="text-xs text-slate-500">Billed party</p></div></div>
            <p className="font-semibold text-slate-900 break-anywhere">{inv.customerName}</p>
            {inv.customerAddress && <p className="mt-1 text-sm leading-6 text-slate-500 break-anywhere">{inv.customerAddress}</p>}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-4 font-bold text-slate-950">Invoice summary</h2>
            <div className="space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-800">{formatCurrency(inv.subtotal, currency)}</span></div>{inv.discount > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Discount</span><span className="font-medium text-emerald-600">− {formatCurrency(inv.discount, currency)}</span></div>}<div className="flex justify-between gap-4"><span className="text-slate-500">Shipping</span><span className="font-medium text-slate-800">{formatCurrency(inv.shipping, currency)}</span></div><div className="border-t border-slate-200 pt-3"><div className="flex justify-between gap-4"><span className="font-bold text-slate-950">Total</span><span className="text-lg font-bold text-primary-700">{formatCurrency(inv.grandTotal, currency)}</span></div></div></div>
          </Card>

          {inv.notes && <Card className="p-4 sm:p-5"><h2 className="font-bold text-slate-950">Notes</h2><p className="mt-2 whitespace-pre-wrap break-anywhere text-sm leading-6 text-slate-500">{inv.notes}</p></Card>}

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-bold text-slate-950">Actions</h2>
            <div className="space-y-2">
              <DocumentCommunicationActions compact={false} document={{type: 'Invoice', number: inv.number, customerName: inv.customerName, amount: inv.grandTotal, currency, status, recordPath: `/invoices/${inv.id}`}} onSharePdf={() => shareInvoicePdf({invoice: inv, business, paymentMethods, settings})} onDownloadPdf={downloadInvoicePdf} />
              {!editLockReason && <button type="button" onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="ui-secondary-button w-full"><FiEdit3 /> Edit Invoice</button>}
              {status === 'draft' && <button type="button" onClick={() => setDialog({type: 'delete'})} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50"><FiTrash2 /> Delete Draft</button>}
              {['unpaid', 'overdue'].includes(status) && <button type="button" onClick={() => setDialog({type: 'cancel'})} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50"><FiXCircle /> Cancel Invoice</button>}
            </div>
          </Card>
        </div>
      </div>

      {dialogProps && <ConfirmDialog open title={dialogProps.title} description={dialogProps.description} confirmLabel={dialogProps.confirmLabel} reasonLabel={dialog?.type === 'reverse' ? 'Reason for reversal' : undefined} reasonPlaceholder={dialog?.type === 'reverse' ? 'Explain why this payment is being reversed' : undefined} reasonRequired={dialogProps.reasonRequired} onCancel={() => setDialog(null)} onConfirm={dialogProps.onConfirm} />}
    </div>
  );
}
