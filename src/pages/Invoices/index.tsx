import {useState, useMemo} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiFileText, FiPlus, FiSearch} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, searchItems, getInvoiceStatus} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';

const filters = ['all', 'unpaid', 'partially_paid', 'paid', 'overdue', 'draft'] as const;
type InvoiceFilter = (typeof filters)[number];

export default function Invoices() {
  const navigate = useNavigate();
  const {invoices, setCurrentPage, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const filtered = useMemo(() => {
    let result = searchItems(invoices, query, [
      (invoice) => invoice.number,
      (invoice) => invoice.customerName,
      (invoice) => invoice.customerPhone,
      (invoice) => invoice.customerTpin,
      (invoice) => invoice.grandTotal,
      (invoice) => invoice.referenceNumber,
    ]);
    if (filter !== 'all') result = result.filter((i) => getInvoiceStatus(i) === filter);
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [invoices, query, filter]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create, send and manage invoices for your customers."
        actions={
          <button type="button" onClick={() => { setCurrentPage('invoices'); navigate('/invoices/new'); }} className="ui-primary-button whitespace-nowrap"><FiPlus className="h-4 w-4" /> New Invoice</button>
        }
      />

      <div className="mb-4 sm:w-80">
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search invoices" aria-label="Search invoices" value={query} onChange={(event) => setQuery(event.target.value)} className="ui-field ui-field-with-icon" />
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filter === f ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f === 'all' ? 'All' : f.replace('_', ' ')}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No invoices yet" description="Create your first invoice and send it directly to your customer." action={{label: 'Create Invoice', onClick: () => navigate('/invoices/new')}} />
      ) : (
        <div className="grid gap-3">
          {filtered.map((inv) => (
            <div key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-medium sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiFileText className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="break-anywhere font-semibold text-slate-900">{inv.number}</p>
                  <p className="break-anywhere truncate text-xs text-slate-500">{inv.customerName} · {money(inv.grandTotal)}</p>
                </div>
              </div>
              <div className="flex w-full items-center justify-between gap-3 text-left sm:w-auto sm:flex-col sm:items-end sm:justify-center sm:text-right">
                <StatusBadge status={getInvoiceStatus(inv)} />
                <p className="shrink-0 text-xs text-slate-400">{money(inv.balanceDue)} balance</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}