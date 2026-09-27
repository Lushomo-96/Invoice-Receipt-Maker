import {useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {FiArrowLeft, FiBriefcase, FiCalendar, FiCreditCard, FiEdit3, FiFile, FiFileText, FiMail, FiMapPin, FiPhone, FiUser} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, formatDate, getInvoiceStatus, getQuotationStatus, isReceiptVoided} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';

export default function CustomerDetail() {
  const navigate = useNavigate();
  const {id} = useParams();
  const {customers, invoices, receipts, quotations, setCurrentPage, business} = useStore();
  const [tab, setTab] = useState<'all' | 'invoices' | 'receipts' | 'quotes'>('all');
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const customer = customers.find((candidate) => candidate.id === id);

  if (!customer) return <EmptyState title="Customer not found" description="This customer may have been deleted." />;

  const customerInvoices = invoices.filter((invoice) => invoice.customerId === id);
  const customerReceipts = receipts.filter((receipt) => receipt.customerId === id);
  const customerQuotations = quotations.filter((quotation) => quotation.customerId === id);
  const totalInvoiced = customerInvoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
  const totalPaid = customerInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const outstanding = customer.outstandingBalance;

  const documents = [
    ...customerInvoices.map((invoice) => ({id: invoice.id, kind: 'Invoice' as const, number: invoice.number, date: invoice.issueDate, amount: invoice.grandTotal, status: getInvoiceStatus(invoice), path: `/invoices/${invoice.id}`})),
    ...customerReceipts.map((receipt) => ({id: receipt.id, kind: 'Receipt' as const, number: receipt.number, date: receipt.date, amount: receipt.amountReceived, status: isReceiptVoided(receipt) ? 'voided' : 'paid', path: `/receipts/${receipt.id}`})),
    ...customerQuotations.map((quotation) => ({id: quotation.id, kind: 'Quote' as const, number: quotation.number, date: quotation.issueDate, amount: quotation.total, status: getQuotationStatus(quotation), path: `/quotations/${quotation.id}`})),
  ].filter((document) => tab === 'all' || (tab === 'invoices' && document.kind === 'Invoice') || (tab === 'receipts' && document.kind === 'Receipt') || (tab === 'quotes' && document.kind === 'Quote')).sort((a, b) => b.date - a.date);

  const contactItems = [
    {icon: FiPhone, label: 'Phone', value: customer.phone},
    {icon: FiMail, label: 'Email', value: customer.email},
    {icon: FiMapPin, label: 'Address', value: [customer.address, customer.townCity, customer.country].filter(Boolean).join(', ')},
    {icon: FiFileText, label: 'TPIN', value: customer.tpin},
    {icon: FiCalendar, label: 'Customer since', value: formatDate(customer.createdAt)},
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <button type="button" onClick={() => navigate('/customers')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><FiArrowLeft /> Back to customers</button>

      <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-primary-50/80 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-xl font-bold text-white shadow-[0_10px_24px_rgba(91,52,245,0.2)]">{customer.name.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-[-0.02em] text-slate-950 break-anywhere">{customer.name}</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-600 ring-1 ring-slate-200">{customer.type === 'business' ? <FiBriefcase /> : <FiUser />}{customer.type}</span></div>
              <p className="mt-1 text-sm text-slate-500 break-anywhere">{customer.businessName || customer.email || customer.phone || 'Customer profile'}</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate(`/customers/${id}/edit`)} className="ui-secondary-button w-full sm:w-auto"><FiEdit3 /> Edit Customer</button>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['Total invoiced', money(totalInvoiced), FiFileText, 'text-primary-600 bg-primary-50'], ['Total paid', money(totalPaid), FiCreditCard, 'text-emerald-600 bg-emerald-50'], ['Outstanding', money(outstanding), FiFile, outstanding > 0 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50']].map(([label, value, Icon, tone]) => {
          const StatIcon = Icon as typeof FiFileText;
          return <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><StatIcon /></span><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label as string}</p><p className="mt-1 text-lg font-bold text-slate-950">{value as string}</p></div></div></div>;
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.6fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="ui-section-title">Contact information</h2>
            <div className="mt-4 space-y-4">
              {contactItems.map((item) => <div key={item.label} className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500"><item.icon /></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{item.label}</p><p className="mt-0.5 text-sm font-medium text-slate-800 break-anywhere">{item.value || 'Not provided'}</p></div></div>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="ui-section-title">Quick actions</h2>
            <div className="mt-4 grid gap-2">
              {[{label: 'Create Invoice', page: 'invoices', path: '/invoices/new', icon: FiFileText, state: {customerId: customer.id}}, {label: 'Create Quotation', page: 'quotations', path: '/quotations/new', icon: FiFile, state: {customerId: customer.id}}, {label: 'Record Payment', page: 'payments', path: '/payments', icon: FiCreditCard, state: undefined}].map((action) => <button key={action.label} type="button" onClick={() => {setCurrentPage(action.page); navigate(action.path, action.state ? {state: action.state} : undefined);}} className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"><span className="flex items-center gap-2.5"><action.icon className="text-primary-600" />{action.label}</span><span aria-hidden>→</span></button>)}
            </div>
          </section>

          {customer.notes && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h2 className="ui-section-title">Notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 break-anywhere">{customer.notes}</p></section>}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div><h2 className="ui-section-title">Document history</h2><p className="mt-1 text-sm text-slate-500">Invoices, receipts and quotations for this customer.</p></div>
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
              {([['all', 'All'], ['invoices', 'Invoices'], ['receipts', 'Receipts'], ['quotes', 'Quotes']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === value ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
            </div>
          </div>

          {documents.length === 0 ? <EmptyState title="No documents in this view" description="Documents created for this customer will appear here." /> : <div className="divide-y divide-slate-100">{documents.map((document) => <button key={`${document.kind}-${document.id}`} type="button" onClick={() => navigate(document.path)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 sm:px-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-primary-600">{document.kind === 'Invoice' ? <FiFileText /> : document.kind === 'Receipt' ? <FiCreditCard /> : <FiFile />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 break-anywhere">{document.number}</p><span className="text-xs font-medium text-slate-400">{document.kind}</span></div><p className="mt-0.5 text-xs text-slate-500">{formatDate(document.date)}</p></div><div className="shrink-0 text-right"><p className="mb-1 text-sm font-bold text-slate-900">{money(document.amount)}</p><StatusBadge status={document.status} /></div></button>)}</div>}
        </section>
      </div>
    </div>
  );
}
