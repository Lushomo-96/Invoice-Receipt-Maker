import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiBox, FiChevronRight, FiPackage, FiPlus, FiSearch, FiTool} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {formatCurrency, searchItems} from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';
import PageHeader from '../../components/PageHeader';

export default function Items() {
  const navigate = useNavigate();
  const {items, setCurrentPage} = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'product' | 'service'>('all');

  const filtered = useMemo(() => {
    let result = searchItems(items, query, [(item) => item.name, (item) => item.description, (item) => item.sku, (item) => item.barcode, (item) => item.price]);
    if (filter !== 'all') result = result.filter((item) => item.type === filter);
    return [...result].sort((a, b) => b.createdAt - a.createdAt);
  }, [filter, items, query]);

  const products = items.filter((item) => item.type === 'product').length;
  const services = items.filter((item) => item.type === 'service').length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Products & Services" description="Maintain reusable items, pricing, tax defaults and stock information for faster document creation." actions={<button type="button" onClick={() => {setCurrentPage('items'); navigate('/items/new');}} className="ui-primary-button w-full sm:w-auto"><FiPlus /> Add Item</button>} />

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[['All items', items.length, FiBox, 'text-primary-600 bg-primary-50'], ['Products', products, FiPackage, 'text-blue-600 bg-blue-50'], ['Services', services, FiTool, 'text-emerald-600 bg-emerald-50']].map(([label, value, Icon, tone]) => {
          const StatIcon = Icon as typeof FiBox;
          return <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><StatIcon /></div><p className="text-xl font-bold text-slate-950">{value as number}</p><p className="mt-0.5 text-xs font-semibold text-slate-400">{label as string}</p></div>;
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-xl"><FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" placeholder="Search item, SKU or barcode" aria-label="Search products and services" value={query} onChange={(event) => setQuery(event.target.value)} className="ui-field ui-field-with-icon" /></div>
            <div className="flex gap-2 rounded-xl bg-slate-50 p-1">{(['all', 'product', 'service'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-3.5 py-2 text-sm font-semibold capitalize transition-colors ${filter === value ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{value}</button>)}</div>
          </div>
        </div>

        {filtered.length === 0 ? <EmptyState icon={<FiBox className="h-7 w-7 text-primary-500" />} title={items.length === 0 ? 'No products or services yet' : 'No items match your search'} description={items.length === 0 ? 'Add your common products and services so you can reuse them on documents.' : 'Try a different search term or item type.'} action={items.length === 0 ? {label: 'Add Item', onClick: () => navigate('/items/new')} : undefined} /> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"><tr><th scope="col" className="px-5 py-3.5">Item</th><th scope="col" className="px-5 py-3.5">SKU / Barcode</th><th scope="col" className="px-5 py-3.5">Type</th><th scope="col" className="px-5 py-3.5 text-right">Price</th><th scope="col" className="px-5 py-3.5 text-right">Tax</th><th scope="col" className="px-5 py-3.5 text-right">Stock</th><th scope="col" className="w-14 px-4 py-3.5" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => <tr key={item.id} tabIndex={0} role="link" onClick={() => navigate(`/items/${item.id}/edit`)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/items/${item.id}/edit`); } }} className="cursor-pointer hover:bg-slate-50/70 focus-visible:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.type === 'product' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.type === 'product' ? <FiPackage /> : <FiTool />}</span><div className="min-w-0"><p className="font-semibold text-slate-900 break-anywhere">{item.name}</p><p className="mt-0.5 max-w-sm text-xs text-slate-500 break-anywhere">{item.description || `${item.unit} unit`}</p></div></div></td><td className="px-5 py-4"><p className="font-medium text-slate-700 break-anywhere">{item.sku || '—'}</p>{item.barcode && <p className="mt-0.5 text-xs text-slate-400 break-anywhere">{item.barcode}</p>}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{item.type}</span></td><td className="px-5 py-4 text-right font-bold text-slate-900">{formatCurrency(item.price, item.currency || 'ZMW')}</td><td className="px-5 py-4 text-right text-slate-600">{item.tax}%{item.taxInclusive ? ' incl.' : ''}</td><td className="px-5 py-4 text-right text-slate-600">{item.type === 'product' ? item.stockQuantity : '—'}</td><td className="px-4 py-4"><FiChevronRight className="ml-auto text-slate-400" /></td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">{filtered.map((item) => <button key={item.id} type="button" onClick={() => navigate(`/items/${item.id}/edit`)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.type === 'product' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.type === 'product' ? <FiPackage /> : <FiTool />}</span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 break-anywhere">{item.name}</p><p className="mt-0.5 text-xs text-slate-500 break-anywhere">{item.sku || item.description || item.unit}</p></div><div className="shrink-0 text-right"><p className="text-sm font-bold text-slate-900">{formatCurrency(item.price, item.currency || 'ZMW')}</p><p className="text-[11px] capitalize text-slate-400">{item.type}</p></div></button>)}</div>
          </>
        )}
      </div>
    </div>
  );
}
