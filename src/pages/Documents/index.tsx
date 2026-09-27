import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiCalendar, FiFile, FiFileText, FiPlus, FiSearch} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, cn, getInvoiceStatus, getQuotationStatus, isReceiptVoided, searchItems} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import {toast} from 'react-hot-toast';
import {createInvoicePdf, createQuotationPdf, createReceiptPdf, downloadPdf, invoicePdfFilename, quotationPdfFilename, receiptPdfFilename, shareInvoicePdf, shareQuotationPdf, shareReceiptPdf} from '../../utils/documentPdf';
import DocumentCommunicationActions from '../../components/DocumentCommunicationActions';
import StatusBadge from '../../components/StatusBadge';

const documentTabs = ['all', 'invoice', 'receipt', 'quotation'] as const;
type DocumentTab = (typeof documentTabs)[number];
const statusOptions = ['all', 'paid', 'sent', 'draft', 'unpaid', 'partially_paid', 'overdue', 'voided', 'accepted', 'rejected', 'expired', 'cancelled'] as const;

export default function Documents() {
  const navigate = useNavigate();
  const {invoices, quotations, receipts, business, paymentMethods, settings} = useStore();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<DocumentTab>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const allDocs = useMemo(() => {
    const docs = [
      ...invoices.map((invoice) => ({type: 'invoice' as const, id: invoice.id, number: invoice.number, customer: invoice.customerName, date: invoice.issueDate, amount: invoice.grandTotal, status: getInvoiceStatus(invoice)})),
      ...quotations.map((quotation) => ({type: 'quotation' as const, id: quotation.id, number: quotation.number, customer: quotation.customerName, date: quotation.issueDate, amount: quotation.total, status: getQuotationStatus(quotation)})),
      ...receipts.map((receipt) => ({type: 'receipt' as const, id: receipt.id, number: receipt.number, customer: receipt.customerName, date: receipt.date, amount: receipt.amountReceived, status: isReceiptVoided(receipt) ? 'voided' as const : 'paid' as const})),
    ];
    let filtered = searchItems(docs, query, [(doc) => doc.number, (doc) => doc.customer, (doc) => doc.amount, (doc) => doc.status]);
    if (tab !== 'all') filtered = filtered.filter((doc) => doc.type === tab);
    if (statusFilter !== 'all') filtered = filtered.filter((doc) => doc.status === statusFilter);
    if (dateFilter !== 'all') {
      const days = Number(dateFilter);
      const floor = Date.now() - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((doc) => doc.date >= floor);
    }
    return filtered.sort((a, b) => b.date - a.date);
  }, [invoices, quotations, receipts, query, tab, statusFilter, dateFilter]);

  const openDocument = (type: 'invoice' | 'quotation' | 'receipt', id: string) => {
    navigate(type === 'invoice' ? `/invoices/${id}` : type === 'quotation' ? `/quotations/${id}` : `/receipts/${id}`);
  };

  const handleDownload = (type: 'invoice' | 'quotation' | 'receipt', id: string) => {
    if (type === 'invoice') {
      const invoice = invoices.find((item) => item.id === id);
      if (!invoice) return;
      downloadPdf(createInvoicePdf({invoice, business, paymentMethods, settings}), invoicePdfFilename(invoice));
    } else if (type === 'quotation') {
      const quotation = quotations.find((item) => item.id === id);
      if (!quotation) return;
      downloadPdf(createQuotationPdf({quotation, business, settings}), quotationPdfFilename(quotation));
    } else {
      const receipt = receipts.find((item) => item.id === id);
      if (!receipt) return;
      const linkedInvoice = receipt.linkedInvoiceId ? invoices.find((invoice) => invoice.id === receipt.linkedInvoiceId) : undefined;
      downloadPdf(createReceiptPdf({receipt, business, linkedInvoice, settings}), receiptPdfFilename(receipt));
    }
    toast.success('PDF downloaded.');
  };

  const handleShare = async (type: 'invoice' | 'quotation' | 'receipt', id: string): Promise<boolean> => {
    if (type === 'invoice') {
      const invoice = invoices.find((item) => item.id === id);
      return invoice ? shareInvoicePdf({invoice, business, paymentMethods, settings}) : false;
    }
    if (type === 'quotation') {
      const quotation = quotations.find((item) => item.id === id);
      return quotation ? shareQuotationPdf({quotation, business, settings}) : false;
    }
    const receipt = receipts.find((item) => item.id === id);
    if (!receipt) return false;
    const linkedInvoice = receipt.linkedInvoiceId ? invoices.find((invoice) => invoice.id === receipt.linkedInvoiceId) : undefined;
    return shareReceiptPdf({receipt, business, linkedInvoice, settings});
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl">Documents</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">Manage invoices, receipts and quotations in one place.</p>
        </div>
        <button type="button" onClick={() => navigate('/invoices/new')} className="ui-primary-button w-full sm:w-auto"><FiPlus className="h-4 w-4" /> Create Invoice</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
        <div className="border-b border-slate-100 p-3 sm:p-4 lg:p-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {documentTabs.map((value) => {
              const label = value === 'all' ? 'All Documents' : value === 'invoice' ? 'Invoices' : value === 'receipt' ? 'Receipts' : 'Quotations';
              const Icon = value === 'quotation' ? FiFile : FiFileText;
              return (
                <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={cn('flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all', tab === value ? 'bg-primary-600 text-white shadow-[0_8px_18px_rgba(91,52,245,0.18)]' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_170px]">
            <div className="relative">
              <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by document number, customer or amount..." aria-label="Search documents" className="ui-field ui-field-with-icon" />
            </div>
            <select aria-label="Document status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ui-field capitalize">
              {statusOptions.map((status) => <option key={status} value={status}>{status === 'all' ? 'All statuses' : status.replace('_', ' ')}</option>)}
            </select>
            <div className="relative">
              <FiCalendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select aria-label="Document date filter" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="ui-field ui-field-with-icon">
                <option value="all">All dates</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 12 months</option>
              </select>
            </div>
          </div>
        </div>

        {allDocs.length === 0 ? (
          <div className="p-8"><EmptyState title="No documents found" description="Try another filter or create your first document." action={{label: 'Create Invoice', onClick: () => navigate('/invoices/new')}} /></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[930px] border-separate border-spacing-0 text-left">
                <thead className="bg-slate-50/80">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    <th scope="col" className="border-b border-slate-100 px-5 py-3.5">Document #</th>
                    <th scope="col" className="border-b border-slate-100 px-5 py-3.5">Customer</th>
                    <th scope="col" className="border-b border-slate-100 px-5 py-3.5">Date</th>
                    <th scope="col" className="border-b border-slate-100 px-5 py-3.5 text-right">Amount</th>
                    <th scope="col" className="border-b border-slate-100 px-5 py-3.5">Status</th>
                    <th scope="col" className="border-b border-slate-100 px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allDocs.map((doc) => (
                    <tr key={`${doc.type}-${doc.id}`} tabIndex={0} role="link" onClick={() => openDocument(doc.type, doc.id)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openDocument(doc.type, doc.id); } }} className="cursor-pointer text-sm transition-colors hover:bg-slate-50/70 focus-visible:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500">
                      <td className="border-b border-slate-100 px-5 py-4"><p className="font-semibold text-slate-900">{doc.number}</p><p className="mt-0.5 text-xs capitalize text-slate-400">{doc.type}</p></td>
                      <td className="border-b border-slate-100 px-5 py-4 font-medium text-slate-700">{doc.customer || 'No customer'}</td>
                      <td className="border-b border-slate-100 px-5 py-4 text-slate-500">{new Date(doc.date).toLocaleDateString('en-ZM', {year: 'numeric', month: 'short', day: 'numeric'})}</td>
                      <td className="border-b border-slate-100 px-5 py-4 text-right font-semibold text-slate-900">{formatCurrency(doc.amount, business?.currency || 'ZMW')}</td>
                      <td className="border-b border-slate-100 px-5 py-4"><StatusBadge status={doc.status} /></td>
                      <td className="border-b border-slate-100 px-5 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                        <DocumentCommunicationActions
                          compact
                          document={{type: doc.type === 'invoice' ? 'Invoice' : doc.type === 'quotation' ? 'Quotation' : 'Receipt', number: doc.number, customerName: doc.customer, amount: doc.amount, currency: business?.currency || 'ZMW', status: doc.status, recordPath: doc.type === 'invoice' ? `/invoices/${doc.id}` : doc.type === 'quotation' ? `/quotations/${doc.id}` : `/receipts/${doc.id}`}}
                          onSharePdf={() => handleShare(doc.type, doc.id)}
                          onDownloadPdf={() => handleDownload(doc.type, doc.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {allDocs.map((doc) => (
                <div key={`${doc.type}-${doc.id}`} className="p-4">
                  <button type="button" onClick={() => openDocument(doc.type, doc.id)} className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-900">{doc.number}</p><StatusBadge status={doc.status} /></div>
                      <p className="mt-1 truncate text-sm text-slate-600">{doc.customer || 'No customer'}</p>
                      <p className="mt-1 text-xs text-slate-400">{new Date(doc.date).toLocaleDateString('en-ZM', {year: 'numeric', month: 'short', day: 'numeric'})}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-slate-900">{formatCurrency(doc.amount, business?.currency || 'ZMW')}</p>
                  </button>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <DocumentCommunicationActions
                      compact
                      document={{type: doc.type === 'invoice' ? 'Invoice' : doc.type === 'quotation' ? 'Quotation' : 'Receipt', number: doc.number, customerName: doc.customer, amount: doc.amount, currency: business?.currency || 'ZMW', status: doc.status, recordPath: doc.type === 'invoice' ? `/invoices/${doc.id}` : doc.type === 'quotation' ? `/quotations/${doc.id}` : `/receipts/${doc.id}`}}
                      onSharePdf={() => handleShare(doc.type, doc.id)}
                      onDownloadPdf={() => handleDownload(doc.type, doc.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span>{allDocs.length} document{allDocs.length === 1 ? '' : 's'} shown</span>
          <span>Use search and filters to narrow your records.</span>
        </div>
      </div>
    </div>
  );
}
