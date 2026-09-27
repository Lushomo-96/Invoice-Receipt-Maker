import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiArrowRight, FiBriefcase, FiMail, FiPhone, FiPlus, FiSearch, FiUser, FiUsers} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, searchItems} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';

export default function Customers() {
  const navigate = useNavigate();
  const {customers, setCurrentPage, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'balance' | 'business' | 'individual'>('all');

  const filtered = useMemo(() => {
    let result = searchItems(customers, query, [
      (customer) => customer.name,
      (customer) => customer.businessName,
      (customer) => customer.phone,
      (customer) => customer.email,
      (customer) => customer.tpin,
    ]);
    if (filter === 'balance') result = result.filter((customer) => customer.outstandingBalance > 0);
    if (filter === 'business') result = result.filter((customer) => customer.type === 'business');
    if (filter === 'individual') result = result.filter((customer) => customer.type === 'individual');
    return [...result].sort((a, b) => b.createdAt - a.createdAt);
  }, [customers, filter, query]);

  const totalOutstanding = customers.reduce((sum, customer) => sum + customer.outstandingBalance, 0);
  const withBalance = customers.filter((customer) => customer.outstandingBalance > 0).length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Customers"
        description="Keep customer details, balances and document history in one place."
        actions={(
          <button type="button" onClick={() => {setCurrentPage('customers'); navigate('/customers/new');}} className="ui-primary-button w-full sm:w-auto">
            <FiPlus className="h-4 w-4" /> Add Customer
          </button>
        )}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400"><FiUsers className="h-4 w-4 text-primary-500" /> Customers</div>
          <p className="mt-2 text-2xl font-bold text-slate-950">{customers.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400"><FiBriefcase className="h-4 w-4 text-amber-500" /> With balance</div>
          <p className="mt-2 text-2xl font-bold text-slate-950">{withBalance}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft lg:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Outstanding</div>
          <p className="mt-2 text-2xl font-bold text-slate-950">{money(totalOutstanding)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-xl">
              <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" placeholder="Search by name, phone, email or TPIN" aria-label="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} className="ui-field ui-field-with-icon" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {([
                ['all', 'All'],
                ['balance', 'With balance'],
                ['business', 'Businesses'],
                ['individual', 'Individuals'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${filter === value ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<FiUsers className="h-7 w-7 text-primary-500" />}
            title={customers.length === 0 ? 'No customers yet' : 'No customers match your filters'}
            description={customers.length === 0 ? 'Add your first customer to start creating invoices, quotations and receipts.' : 'Try another search term or clear the current filter.'}
            action={customers.length === 0 ? {label: 'Add Customer', onClick: () => navigate('/customers/new')} : undefined}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <tr><th scope="col" className="px-5 py-3.5">Customer</th><th scope="col" className="px-5 py-3.5">Contact</th><th scope="col" className="px-5 py-3.5">Type</th><th scope="col" className="px-5 py-3.5 text-right">Outstanding</th><th scope="col" className="w-16 px-5 py-3.5" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((customer) => (
                    <tr key={customer.id} tabIndex={0} role="link" onClick={() => navigate(`/customers/${customer.id}`)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/customers/${customer.id}`); } }} className="cursor-pointer transition-colors hover:bg-slate-50/70 focus-visible:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 font-bold text-primary-700">{customer.name.charAt(0).toUpperCase()}</div>
                          <div className="min-w-0"><p className="font-semibold text-slate-900 break-anywhere">{customer.name}</p><p className="mt-0.5 text-xs text-slate-500 break-anywhere">{customer.businessName || customer.tpin || 'No additional details'}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="space-y-1 text-xs text-slate-500">{customer.phone && <p className="flex items-center gap-1.5"><FiPhone /> {customer.phone}</p>}{customer.email && <p className="flex items-center gap-1.5 break-anywhere"><FiMail /> {customer.email}</p>}{!customer.phone && !customer.email && <span>—</span>}</div></td>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{customer.type === 'business' ? <FiBriefcase /> : <FiUser />}{customer.type}</span></td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{money(customer.outstandingBalance)}</td>
                      <td className="px-5 py-4 text-right"><FiArrowRight className="ml-auto h-4 w-4 text-slate-400" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((customer) => (
                <button key={customer.id} type="button" onClick={() => navigate(`/customers/${customer.id}`)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 font-bold text-primary-700">{customer.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 break-anywhere">{customer.name}</p><p className="mt-0.5 text-xs text-slate-500 break-anywhere">{customer.businessName || customer.phone || customer.email || customer.type}</p></div>
                  <div className="shrink-0 text-right"><p className="text-sm font-bold text-slate-900">{money(customer.outstandingBalance)}</p><p className="text-[11px] text-slate-400">Outstanding</p></div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
