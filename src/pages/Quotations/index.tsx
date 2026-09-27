import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiCheckCircle, FiClock, FiFileText, FiPlus, FiSearch, FiSend, FiXCircle} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, formatDate, getQuotationStatus, searchItems} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

export default function Quotations() {
  const navigate = useNavigate();
  const {quotations, setCurrentPage, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'accepted' | 'expired' | 'rejected'>('all');

  const filtered = useMemo(() => {
    let result = searchItems(quotations, query, [(quotation) => quotation.number, (quotation) => quotation.customerName, (quotation) => quotation.total, (quotation) => getQuotationStatus(quotation)]);
    if (statusFilter !== 'all') result = result.filter((quotation) => getQuotationStatus(quotation) === statusFilter);
    return [...result].sort((a, b) => b.issueDate - a.issueDate);
  }, [query, quotations, statusFilter]);

  const counts = {
    draft: quotations.filter((quotation) => getQuotationStatus(quotation) === 'draft').length,
    sent: quotations.filter((quotation) => getQuotationStatus(quotation) === 'sent').length,
    accepted: quotations.filter((quotation) => getQuotationStatus(quotation) === 'accepted').length,
    expired: quotations.filter((quotation) => getQuotationStatus(quotation) === 'expired').length,
    rejected: quotations.filter((quotation) => getQuotationStatus(quotation) === 'rejected').length,
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Quotations" description="Create proposals, track responses and convert accepted quotations into invoices." actions={<button type="button" onClick={() => {setCurrentPage('quotations'); navigate('/quotations/new');}} className="ui-primary-button w-full sm:w-auto"><FiPlus /> New Quotation</button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[['Draft', counts.draft, FiFileText, 'bg-slate-100 text-slate-600'], ['Sent', counts.sent, FiSend, 'bg-blue-50 text-blue-600'], ['Accepted', counts.accepted, FiCheckCircle, 'bg-emerald-50 text-emerald-600'], ['Expired', counts.expired, FiClock, 'bg-orange-50 text-orange-600'], ['Rejected', counts.rejected, FiXCircle, 'bg-rose-50 text-rose-600']].map(([label, value, Icon, tone]) => {const StatIcon = Icon as typeof FiFileText; return <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><StatIcon /></span><p className="text-2xl font-bold text-slate-950">{value as number}</p><p className="mt-0.5 text-xs font-semibold text-slate-400">{label as string}</p></div>;})}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative flex-1 lg:max-w-xl"><FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quotation or customer" aria-label="Search quotations" className="ui-field ui-field-with-icon" /></div><div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">{(['all', 'draft', 'sent', 'accepted', 'expired', 'rejected'] as const).map((value) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${statusFilter === value ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{value}</button>)}</div></div></div>

        {filtered.length === 0 ? <EmptyState icon={<FiFileText className="h-7 w-7 text-primary-500" />} title={quotations.length === 0 ? 'No quotations yet' : 'No quotations match your filters'} description={quotations.length === 0 ? 'Create a quotation and send it to a customer. Accepted quotations can be converted into invoices.' : 'Try another search or status filter.'} action={quotations.length === 0 ? {label: 'Create Quotation', onClick: () => navigate('/quotations/new')} : undefined} /> : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"><tr><th scope="col" className="px-5 py-3.5">Quotation</th><th scope="col" className="px-5 py-3.5">Customer</th><th scope="col" className="px-5 py-3.5">Issued</th><th scope="col" className="px-5 py-3.5">Expires</th><th scope="col" className="px-5 py-3.5 text-right">Total</th><th scope="col" className="px-5 py-3.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((quotation) => {const status = getQuotationStatus(quotation); return <tr key={quotation.id} tabIndex={0} role="link" onClick={() => navigate(`/quotations/${quotation.id}`)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/quotations/${quotation.id}`); } }} className="cursor-pointer hover:bg-slate-50/70 focus-visible:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"><td className="px-5 py-4"><p className="font-semibold text-slate-900 break-anywhere">{quotation.number}</p>{quotation.convertedInvoiceId && <p className="mt-0.5 text-xs text-emerald-600">Converted to invoice</p>}</td><td className="px-5 py-4"><p className="font-medium text-slate-800 break-anywhere">{quotation.customerName || 'No customer'}</p></td><td className="px-5 py-4 text-slate-600">{formatDate(quotation.issueDate)}</td><td className="px-5 py-4 text-slate-600">{formatDate(quotation.expiryDate)}</td><td className="px-5 py-4 text-right font-bold text-slate-900">{money(quotation.total)}</td><td className="px-5 py-4"><StatusBadge status={status} /></td></tr>;})}</tbody></table></div>
            <div className="divide-y divide-slate-100 md:hidden">{filtered.map((quotation) => {const status = getQuotationStatus(quotation); return <button key={quotation.id} type="button" onClick={() => navigate(`/quotations/${quotation.id}`)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiFileText /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 break-anywhere">{quotation.number}</p><StatusBadge status={status} /></div><p className="mt-0.5 text-xs text-slate-500 break-anywhere">{quotation.customerName || 'No customer'} · expires {formatDate(quotation.expiryDate)}</p></div><p className="shrink-0 text-sm font-bold text-slate-900">{money(quotation.total)}</p></button>;})}</div>
          </>
        )}
      </div>
    </div>
  );
}
