import {useNavigate, useParams} from 'react-router-dom';
import {FiArrowLeft, FiDownload, FiEdit3, FiFileText, FiShare2} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {toast} from 'react-hot-toast';
import {calculateTotals, formatCurrency, formatDate, getInvoiceEditLockReason, getInvoiceStatus} from '../../utils/helpers';
import {createInvoicePdf, downloadPdf, invoicePdfFilename, shareInvoicePdf} from '../../utils/documentPdf';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import Card from '../../components/Card';

export default function InvoicesPreview() {
  const navigate = useNavigate();
  const {id} = useParams();
  const {invoices, payments, receipts, business, paymentMethods, settings} = useStore();
  const inv = invoices.find((invoice) => invoice.id === id);
  if (!inv) return <EmptyState icon={<FiFileText className="h-7 w-7" />} title="Invoice not found" description="This invoice may have been deleted or is no longer available." />;

  const {totalDiscount, addedTax, includedTax} = calculateTotals(inv.items);
  const currency = business?.currency || 'ZMW';
  const hasPaymentHistory = payments.some((payment) => payment.invoiceId === inv.id);
  const hasReceiptHistory = receipts.some((receipt) => receipt.linkedInvoiceId === inv.id);
  const editLockReason = getInvoiceEditLockReason(inv, hasPaymentHistory, hasReceiptHistory);
  const status = getInvoiceStatus(inv);

  const downloadPdfFile = () => {
    downloadPdf(createInvoicePdf({invoice: inv, business, paymentMethods, settings}), invoicePdfFilename(inv));
    toast.success('Invoice PDF downloaded.');
  };

  const sharePdfFile = async () => {
    try {
      const shared = await shareInvoicePdf({invoice: inv, business, paymentMethods, settings});
      if (shared) {
        toast.success('Invoice PDF shared.');
        return;
      }
      downloadPdf(createInvoicePdf({invoice: inv, business, paymentMethods, settings}), invoicePdfFilename(inv));
      toast('Sharing is not supported on this device, so the PDF was downloaded instead.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error('Unable to share the invoice PDF.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => navigate(`/invoices/${inv.id}`)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><FiArrowLeft /> Back to invoice</button>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          {!editLockReason && <button type="button" onClick={() => navigate(`/invoices/${inv.id}/edit`)} className="ui-secondary-button"><FiEdit3 /> Edit</button>}
          <button type="button" onClick={downloadPdfFile} className="ui-secondary-button"><FiDownload /> Download PDF</button>
          <button type="button" onClick={() => void sharePdfFile()} className="ui-primary-button"><FiShare2 /> Share PDF</button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div><p className="text-sm font-semibold text-slate-900">Invoice preview</p><p className="text-xs text-slate-500">This screen mirrors the information used for your generated PDF.</p></div>
        <StatusBadge status={status} />
      </div>

      <Card className="mx-auto max-w-4xl overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-5 sm:p-7 lg:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {business?.logo ? <img src={business.logo} alt="Business logo" className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-contain bg-white p-1" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white"><FiFileText className="h-6 w-6" /></span>}
              <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-600">Invoice</p><h1 className="mt-1 break-anywhere text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl">{inv.number}</h1><p className="mt-2 text-sm text-slate-500">Issued {formatDate(inv.issueDate)}</p></div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:text-right"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Due date</p><p className="mt-1 font-bold text-slate-950">{formatDate(inv.dueDate)}</p><div className="mt-2"><StatusBadge status={status} /></div></div>
          </div>
        </div>

        <div className="p-5 sm:p-7 lg:p-9">
          <div className="mb-8 grid grid-cols-1 gap-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">From</p><p className="mt-2 font-bold text-slate-950 break-anywhere">{business?.name || 'Business'}</p>{business?.addressLine1 && <p className="mt-1 text-sm leading-6 text-slate-500 break-anywhere">{business.addressLine1}</p>}{business?.townCity && <p className="text-sm leading-6 text-slate-500">{business.townCity}{business.country ? `, ${business.country}` : ''}</p>}{business?.email && <p className="text-sm leading-6 text-slate-500 break-anywhere">{business.email}</p>}{business?.tpin && <p className="text-sm leading-6 text-slate-500">TPIN: {business.tpin}</p>}</div>
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Bill to</p><p className="mt-2 font-bold text-slate-950 break-anywhere">{inv.customerName}</p>{inv.customerAddress && <p className="mt-1 text-sm leading-6 text-slate-500 break-anywhere">{inv.customerAddress}</p>}</div>
          </div>

          <div className="mb-8 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-y border-slate-200 bg-slate-50">{['Item / Description', 'Qty', 'Price', 'Amount'].map((heading, index) => <th scope="col" key={heading} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 ${index === 0 ? 'text-left' : 'text-right'}`}>{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{inv.items.map((item, index) => <tr key={index}><td className="px-4 py-4"><p className="text-sm font-semibold text-slate-900 break-anywhere">{item.name}</p>{item.description && <p className="mt-1 text-xs text-slate-400 break-anywhere">{item.description}</p>}</td><td className="px-4 py-4 text-right text-sm text-slate-600">{item.quantity}</td><td className="px-4 py-4 text-right text-sm text-slate-600">{formatCurrency(item.unitPrice, currency)}</td><td className="px-4 py-4 text-right text-sm font-bold text-slate-950">{formatCurrency(item.amount, currency)}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="mb-8 divide-y divide-slate-100 rounded-2xl border border-slate-200 md:hidden">
            {inv.items.map((item, index) => <div key={index} className="p-4"><p className="text-sm font-bold text-slate-900 break-anywhere">{item.name}</p>{item.description && <p className="mt-1 text-xs leading-5 text-slate-500 break-anywhere">{item.description}</p>}<div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-400">Qty</p><p className="mt-1 font-semibold text-slate-700">{item.quantity}</p></div><div><p className="text-slate-400">Price</p><p className="mt-1 font-semibold text-slate-700">{formatCurrency(item.unitPrice, currency)}</p></div><div className="text-right"><p className="text-slate-400">Amount</p><p className="mt-1 font-bold text-slate-950">{formatCurrency(item.amount, currency)}</p></div></div></div>)}
          </div>

          <div className="mb-8 flex justify-end">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <div className="space-y-2.5 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-800">{formatCurrency(inv.subtotal, currency)}</span></div>{totalDiscount > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Line discounts</span><span className="font-medium text-emerald-600">− {formatCurrency(totalDiscount, currency)}</span></div>}{inv.discount > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Invoice discount</span><span className="font-medium text-emerald-600">− {formatCurrency(inv.discount, currency)}</span></div>}{addedTax > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Tax added</span><span className="font-medium text-slate-800">{formatCurrency(addedTax, currency)}</span></div>}{includedTax > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Tax included</span><span className="font-medium text-slate-800">{formatCurrency(includedTax, currency)}</span></div>}<div className="flex justify-between gap-4"><span className="text-slate-500">Shipping</span><span className="font-medium text-slate-800">{formatCurrency(inv.shipping, currency)}</span></div><div className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3"><span className="font-bold text-slate-950">Total</span><span className="text-xl font-extrabold text-primary-700">{formatCurrency(inv.grandTotal, currency)}</span></div></div>
            </div>
          </div>

          {inv.notes && <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Notes</p><p className="mt-2 whitespace-pre-wrap break-anywhere text-sm leading-6 text-slate-600">{inv.notes}</p></div>}
          <div className="border-t border-slate-200 pt-5 text-center"><p className="text-sm font-medium text-slate-500">Thank you for your business.</p></div>
        </div>
      </Card>
    </div>
  );
}
