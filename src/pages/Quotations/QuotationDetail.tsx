import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {FiArrowLeft, FiCheckCircle, FiEdit3, FiFileText, FiSend, FiUser, FiXCircle} from 'react-icons/fi';
import {toast} from 'react-hot-toast';
import {useStore} from '../../store/useStore';
import {calculateTotals, formatCurrency, formatDate, getQuotationEditLockReason, getQuotationStatus} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import {createQuotationPdf, downloadPdf, quotationPdfFilename, shareQuotationPdf} from '../../utils/documentPdf';
import DocumentCommunicationActions from '../../components/DocumentCommunicationActions';

export default function QuotationDetail() {
  const navigate = useNavigate();
  const {id} = useParams();
  const {quotations, business, settings, setQuotationStatus, convertQuotationToInvoice} = useStore();
  const [confirmAction, setConfirmAction] = useState<'reject' | 'convert' | null>(null);
  const quotation = quotations.find((candidate) => candidate.id === id);
  if (!quotation) return <EmptyState title="Quotation not found" description="This quotation may no longer exist." />;

  const currency = business?.currency || 'ZMW';
  const status = getQuotationStatus(quotation);
  const editLockReason = getQuotationEditLockReason(quotation);
  const totals = calculateTotals(quotation.items);
  const canMarkSent = !quotation.convertedInvoiceId && status === 'draft';
  const canDecide = !quotation.convertedInvoiceId && status === 'sent';
  const canConvert = !quotation.convertedInvoiceId && status === 'accepted';

  const downloadQuotationPdf = () => downloadPdf(createQuotationPdf({quotation, business, settings}), quotationPdfFilename(quotation));

  const changeStatus = (nextStatus: 'sent' | 'accepted' | 'rejected') => {
    const result = setQuotationStatus(quotation.id, nextStatus);
    if (!result.success) {toast.error(result.error ?? 'Unable to update quotation status.'); return;}
    toast.success(`Quotation marked ${nextStatus}`);
  };

  const convert = () => {
    const result = convertQuotationToInvoice(quotation.id);
    if (!result.success || !result.invoice) {toast.error(result.error ?? 'Unable to convert quotation.'); return;}
    toast.success(`Converted to invoice ${result.invoice.number}`);
    navigate(`/invoices/${result.invoice.id}`);
  };

  const handleConfirm = () => {
    if (confirmAction === 'reject') changeStatus('rejected');
    if (confirmAction === 'convert') convert();
    setConfirmAction(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <button type="button" onClick={() => navigate('/quotations')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><FiArrowLeft /> Back to quotations</button>

      <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-primary-50/70 via-white to-white p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Quotation</p><StatusBadge status={status} /></div><h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-950 break-anywhere">{quotation.number}</h1><p className="mt-1 text-sm text-slate-500">Issued {formatDate(quotation.issueDate)} · Expires {formatDate(quotation.expiryDate)}</p>{quotation.convertedInvoiceId && <p className="mt-2 text-sm font-semibold text-emerald-700">Converted to invoice{quotation.convertedAt ? ` on ${formatDate(quotation.convertedAt)}` : ''}.</p>}</div>
          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end"><DocumentCommunicationActions document={{type: 'Quotation', number: quotation.number, customerName: quotation.customerName, amount: quotation.total, currency, status, recordPath: `/quotations/${quotation.id}`}} onSharePdf={() => shareQuotationPdf({quotation, business, settings})} onDownloadPdf={downloadQuotationPdf} />{!editLockReason && <button type="button" onClick={() => navigate(`/quotations/${quotation.id}/edit`)} className="ui-secondary-button"><FiEdit3 /> Edit</button>}{canMarkSent && <button type="button" onClick={() => changeStatus('sent')} className="ui-secondary-button text-blue-700"><FiSend /> Mark Sent</button>}{canDecide && <button type="button" onClick={() => changeStatus('accepted')} className="ui-secondary-button text-emerald-700"><FiCheckCircle /> Accept</button>}{canDecide && <button type="button" onClick={() => setConfirmAction('reject')} className="ui-secondary-button text-rose-700"><FiXCircle /> Reject</button>}{canConvert && <button type="button" onClick={() => setConfirmAction('convert')} className="ui-primary-button"><FiFileText /> Convert to Invoice</button>}{quotation.convertedInvoiceId && <button type="button" onClick={() => navigate(`/invoices/${quotation.convertedInvoiceId}`)} className="ui-primary-button"><FiFileText /> View Invoice</button>}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiUser /></span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Customer</p><p className="mt-1 text-lg font-bold text-slate-950 break-anywhere">{quotation.customerName || 'No customer selected'}</p>{(quotation.customerPhone || quotation.customerAddress || quotation.customerTpin) && <div className="mt-2 space-y-1 text-sm text-slate-500">{quotation.customerPhone && <p>{quotation.customerPhone}</p>}{quotation.customerAddress && <p className="break-anywhere">{quotation.customerAddress}</p>}{quotation.customerTpin && <p>TPIN: {quotation.customerTpin}</p>}</div>}</div></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="border-b border-slate-200 p-4 sm:p-5"><h2 className="ui-section-title">Quoted items</h2><p className="mt-1 text-sm text-slate-500">{quotation.items.length} line item{quotation.items.length === 1 ? '' : 's'}</p></div>
            <div className="divide-y divide-slate-100 md:hidden">{quotation.items.map((item, index) => <div key={`${item.itemId}-${index}`} className="p-4"><div className="min-w-0"><p className="font-semibold text-slate-900 break-anywhere">{item.name}</p>{item.description && <p className="mt-0.5 text-xs text-slate-500 break-anywhere">{item.description}</p>}</div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><div><span className="block text-xs text-slate-400">Qty</span><span>{item.quantity}</span></div><div className="text-right"><span className="block text-xs text-slate-400">Price</span><span>{formatCurrency(item.unitPrice, currency)}</span></div><div><span className="block text-xs text-slate-400">Discount</span><span>{formatCurrency(item.discount, currency)}</span></div><div className="text-right"><span className="block text-xs text-slate-400">Tax</span><span>{item.tax}%{item.taxInclusive ? ' incl.' : ''}</span></div><div className="col-span-2 mt-1 flex justify-between border-t border-slate-100 pt-2 font-bold"><span>Amount</span><span>{formatCurrency(item.amount, currency)}</span></div></div></div>)}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"><tr><th scope="col" className="px-5 py-3.5">Item</th><th scope="col" className="px-5 py-3.5 text-right">Qty</th><th scope="col" className="px-5 py-3.5 text-right">Price</th><th scope="col" className="px-5 py-3.5 text-right">Discount</th><th scope="col" className="px-5 py-3.5 text-right">Tax</th><th scope="col" className="px-5 py-3.5 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{quotation.items.map((item, index) => <tr key={`${item.itemId}-${index}`}><td className="px-5 py-4"><p className="font-semibold text-slate-900 break-anywhere">{item.name}</p>{item.description && <p className="mt-0.5 text-xs text-slate-500 break-anywhere">{item.description}</p>}</td><td className="px-5 py-4 text-right">{item.quantity}</td><td className="px-5 py-4 text-right">{formatCurrency(item.unitPrice, currency)}</td><td className="px-5 py-4 text-right">{formatCurrency(item.discount, currency)}</td><td className="px-5 py-4 text-right">{item.tax}%{item.taxInclusive ? ' incl.' : ''}</td><td className="px-5 py-4 text-right font-bold text-slate-900">{formatCurrency(item.amount, currency)}</td></tr>)}</tbody></table></div>
          </section>

          {(quotation.notes || quotation.terms) && <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{quotation.notes && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h3 className="ui-section-title">Notes</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 break-anywhere">{quotation.notes}</p></section>}{quotation.terms && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h3 className="ui-section-title">Terms & Conditions</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 break-anywhere">{quotation.terms}</p></section>}</div>}
        </div>

        <aside className="xl:sticky xl:top-0 xl:self-start"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h2 className="font-bold text-slate-950">Quotation summary</h2><div className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{formatCurrency(quotation.subtotal, currency)}</span></div><div className="flex justify-between"><span className="text-slate-500">Line discounts</span><span className="font-semibold">{formatCurrency(totals.totalDiscount, currency)}</span></div><div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-semibold">{formatCurrency(quotation.tax, currency)}</span></div>{quotation.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Quote discount</span><span className="font-semibold text-emerald-600">-{formatCurrency(quotation.discount, currency)}</span></div>}</div><div className="flex items-end justify-between gap-3 pt-5"><span className="font-bold text-slate-900">Total</span><span className="text-2xl font-bold tracking-[-0.03em] text-primary-700">{formatCurrency(quotation.total, currency)}</span></div></section></aside>
      </div>

      <ConfirmDialog open={confirmAction === 'reject'} title="Reject this quotation?" description="The quotation will be marked rejected. This status is retained in the customer and quotation history." confirmLabel="Reject Quotation" onCancel={() => setConfirmAction(null)} onConfirm={handleConfirm} />
      <ConfirmDialog open={confirmAction === 'convert'} title="Convert quotation to invoice?" description="A new invoice will be created from the accepted quotation. The quotation will remain linked to that invoice and can no longer be converted again." confirmLabel="Convert to Invoice" tone="primary" onCancel={() => setConfirmAction(null)} onConfirm={handleConfirm} />
    </div>
  );
}
