import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiCheckCircle, FiFileText, FiPlus, FiSearch, FiSlash} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, formatDate, getPaymentMethodLabel, isReceiptVoided} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

export default function Receipts() {
  const navigate = useNavigate();
  const {receipts, setCurrentPage, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voided'>('all');

  const filtered = useMemo(() => receipts.filter((receipt) => {
    const voided = isReceiptVoided(receipt);
    if (statusFilter === 'active' && voided) return false;
    if (statusFilter === 'voided' && !voided) return false;
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return [receipt.number, receipt.customerName, receipt.receivedFrom, receipt.referenceNumber, getPaymentMethodLabel(receipt.paymentMethod)].some((value) => value?.toLowerCase().includes(search));
  }).sort((a, b) => b.date - a.date), [query, receipts, statusFilter]);

  const activeReceipts = receipts.filter((receipt) => !isReceiptVoided(receipt));
  const activeTotal = activeReceipts.reduce((sum, receipt) => sum + receipt.amountReceived, 0);
  const voidedCount = receipts.length - activeReceipts.length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Receipts" description="Review payment receipts, linked invoices and audit history." actions={<button type="button" onClick={() => {setCurrentPage('receipts'); navigate('/receipts/new');}} className="ui-primary-button w-full sm:w-auto"><FiPlus /> New Receipt</button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400"><FiCheckCircle className="text-emerald-500" /> Active</div><p className="mt-2 text-2xl font-bold text-slate-950">{activeReceipts.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400"><FiSlash className="text-rose-500" /> Voided</div><p className="mt-2 text-2xl font-bold text-slate-950">{voidedCount}</p></div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft lg:col-span-1"><div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Active receipts value</div><p className="mt-2 text-2xl font-bold text-slate-950">{money(activeTotal)}</p></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative flex-1 lg:max-w-xl"><FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search receipt, customer, reference or method" aria-label="Search receipts" className="ui-field ui-field-with-icon" /></div><div className="flex gap-2 rounded-xl bg-slate-50 p-1">{(['all', 'active', 'voided'] as const).map((value) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold capitalize transition-colors ${statusFilter === value ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{value}</button>)}</div></div></div>

        {filtered.length === 0 ? <EmptyState icon={<FiFileText className="h-7 w-7 text-primary-500" />} title={receipts.length === 0 ? 'No receipts yet' : 'No receipts match your filters'} description={receipts.length === 0 ? 'Record a payment to automatically generate a receipt and preserve the audit trail.' : 'Try another search or receipt status.'} action={receipts.length === 0 ? {label: 'Create Receipt', onClick: () => navigate('/receipts/new')} : undefined} /> : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"><tr><th scope="col" className="px-5 py-3.5">Receipt</th><th scope="col" className="px-5 py-3.5">Customer</th><th scope="col" className="px-5 py-3.5">Date</th><th scope="col" className="px-5 py-3.5">Method</th><th scope="col" className="px-5 py-3.5 text-right">Amount</th><th scope="col" className="px-5 py-3.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((receipt) => {const voided = isReceiptVoided(receipt); return <tr key={receipt.id} tabIndex={0} role="link" onClick={() => navigate(`/receipts/${receipt.id}`)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/receipts/${receipt.id}`); } }} className="cursor-pointer hover:bg-slate-50/70 focus-visible:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"><td className="px-5 py-4"><p className="font-semibold text-slate-900 break-anywhere">{receipt.number}</p><p className="mt-0.5 text-xs text-slate-400 break-anywhere">{receipt.referenceNumber || receipt.paymentFor || 'Payment receipt'}</p></td><td className="px-5 py-4"><p className="font-medium text-slate-800 break-anywhere">{receipt.receivedFrom || receipt.customerName}</p>{receipt.linkedInvoiceId && <p className="mt-0.5 text-xs text-slate-400">Linked to invoice</p>}</td><td className="px-5 py-4 text-slate-600">{formatDate(receipt.date)}</td><td className="px-5 py-4 text-slate-600">{getPaymentMethodLabel(receipt.paymentMethod)}</td><td className={`px-5 py-4 text-right font-bold ${voided ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{money(receipt.amountReceived)}</td><td className="px-5 py-4"><StatusBadge status={voided ? 'voided' : 'active'} /></td></tr>;})}</tbody></table></div>
            <div className="divide-y divide-slate-100 md:hidden">{filtered.map((receipt) => {const voided = isReceiptVoided(receipt); return <button key={receipt.id} type="button" onClick={() => navigate(`/receipts/${receipt.id}`)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${voided ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{voided ? <FiSlash /> : <FiCheckCircle />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 break-anywhere">{receipt.number}</p><StatusBadge status={voided ? 'voided' : 'active'} /></div><p className="mt-0.5 text-xs text-slate-500 break-anywhere">{receipt.customerName} · {formatDate(receipt.date)}</p></div><p className={`shrink-0 text-sm font-bold ${voided ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{money(receipt.amountReceived)}</p></button>;})}</div>
          </>
        )}
      </div>
    </div>
  );
}
