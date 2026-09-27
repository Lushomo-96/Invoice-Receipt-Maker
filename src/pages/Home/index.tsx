import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useStore} from '../../store/useStore';
import type {PaymentRecord} from '../../types';
import {cn, formatCurrency, formatDate} from '../../utils/helpers';
import {
  buildDashboardDocuments,
  calculateDashboardMetrics,
  calculatePeriodChange,
  getDashboardPeriodRange,
  getPreviousDashboardPeriodRange,
  type DashboardDocument,
  type DashboardPeriod,
} from '../../utils/dashboard';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowRight,
  FiArrowUp,
  FiCheckCircle,
  FiFile,
  FiFileText,
  FiPackage,
  FiSearch,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi';

const periodOptions: DashboardPeriod[] = ['This Week', 'This Month', 'This Quarter', 'This Year', 'All Time'];
const quickFilters = ['All', 'Unpaid', 'Overdue', 'Paid'] as const;
type QuickFilter = (typeof quickFilters)[number];

const statDefinitions = [
  {key: 'sales', label: 'Total Sales', icon: FiTrendingUp, color: 'text-primary-600', bg: 'bg-primary-50'},
  {key: 'outstanding', label: 'Outstanding', icon: FiFileText, color: 'text-amber-600', bg: 'bg-amber-50'},
  {key: 'paid', label: 'Paid', icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50'},
  {key: 'overdue', label: 'Overdue', icon: FiAlertCircle, color: 'text-rose-600', bg: 'bg-rose-50'},
] as const;

function matchesQuickFilter(document: DashboardDocument, filter: QuickFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Paid') return document.status === 'paid';
  if (filter === 'Overdue') return document.type === 'Invoice' && document.isOverdue === true;
  if (filter === 'Unpaid') return document.type === 'Invoice' && (document.status === 'unpaid' || document.status === 'partially_paid');
  return true;
}

function badgeFor(document: DashboardDocument): {status: string; label?: string} {
  if (document.isOverdue && document.status === 'partially_paid') return {status: 'overdue', label: 'overdue balance'};
  return {status: document.status};
}

function DocumentStatusBadge({document}: {document: DashboardDocument}) {
  const {status, label} = badgeFor(document);
  return <StatusBadge status={status} label={label} />;
}

function comparisonLabel(change: number | null, hasPreviousPeriod: boolean): {text: string; direction: 'up' | 'down' | 'flat'} {
  if (!hasPreviousPeriod) return {text: 'All-time total', direction: 'flat'};
  if (change === null) return {text: 'New vs last period', direction: 'up'};
  if (change > 0) return {text: `+${change}% vs last period`, direction: 'up'};
  if (change < 0) return {text: `${change}% vs last period`, direction: 'down'};
  return {text: 'No change vs last period', direction: 'flat'};
}

function buildRevenueScale(maxValue: number) {
  if (maxValue <= 0) return {max: 0, ticks: [] as number[]};

  const rawStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const stepSize = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;
  const step = stepSize * magnitude;
  const max = step * 4;
  return {max, ticks: [4, 3, 2, 1, 0].map((multiple) => step * multiple)};
}

function compactAmount(amount: number): string {
  return new Intl.NumberFormat('en', {notation: 'compact', maximumFractionDigits: 1}).format(amount);
}

function buildSixMonthRevenue(payments: readonly PaymentRecord[]) {
  const now = new Date();
  const months = Array.from({length: 6}, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleDateString('en', {month: 'short'}),
      value: 0,
    };
  });
  for (const payment of payments) {
    if (payment.status === 'reversed') continue;
    const date = new Date(payment.date);
    const bucket = months.find((month) => month.year === date.getFullYear() && month.month === date.getMonth());
    if (bucket) bucket.value += payment.amount;
  }
  return months;
}

export default function Home() {
  const navigate = useNavigate();
  const business = useStore((state) => state.business);
  const invoices = useStore((state) => state.invoices);
  const payments = useStore((state) => state.payments);
  const receipts = useStore((state) => state.receipts);
  const quotations = useStore((state) => state.quotations);
  const customers = useStore((state) => state.customers);
  const money = (amount: number) => formatCurrency(amount, business?.currency || 'ZMW');

  const [period, setPeriod] = useState<DashboardPeriod>('This Month');
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChartIndex, setSelectedChartIndex] = useState(5);

  const now = Date.now();
  const currentRange = useMemo(() => getDashboardPeriodRange(period, now), [period, now]);
  const previousRange = useMemo(() => getPreviousDashboardPeriodRange(period, now), [period, now]);
  const metrics = useMemo(() => calculateDashboardMetrics(invoices, payments, receipts, quotations, customers, currentRange, now), [invoices, payments, receipts, quotations, customers, currentRange, now]);
  const previousMetrics = useMemo(() => previousRange ? calculateDashboardMetrics(invoices, payments, receipts, quotations, customers, previousRange, previousRange.end) : null, [invoices, payments, receipts, quotations, customers, previousRange]);
  const recentDocuments = useMemo(() => buildDashboardDocuments(invoices, receipts, quotations, currentRange, now), [invoices, receipts, quotations, currentRange, now]);
  const chartData = useMemo(() => buildSixMonthRevenue(payments), [payments]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return recentDocuments
      .filter((document) => matchesQuickFilter(document, activeFilter))
      .filter((document) => {
        if (!query) return true;
        return [document.type, document.number, document.customer, document.status, document.isOverdue ? 'overdue past due' : ''].some((value) => value.toLowerCase().includes(query));
      })
      .slice(0, 7);
  }, [recentDocuments, activeFilter, searchQuery]);

  const stats = statDefinitions.map((definition) => {
    const value = metrics[definition.key];
    if (definition.key === 'outstanding') return {...definition, value, comparison: {text: 'Current selected balance', direction: 'flat' as const}};
    if (definition.key === 'overdue') return {...definition, value, comparison: {text: 'Current overdue balance', direction: 'flat' as const}};
    const previousValue = previousMetrics?.[definition.key] ?? 0;
    const change = previousMetrics ? calculatePeriodChange(value, previousValue) : null;
    return {...definition, value, comparison: comparisonLabel(change, previousMetrics !== null)};
  });

  const totalChartRevenue = chartData.reduce((total, item) => total + item.value, 0);
  const hasChartRevenue = chartData.some((item) => item.value > 0);
  const chartScale = buildRevenueScale(Math.max(...chartData.map((item) => item.value), 0));
  const chartGridY = [8, 29, 50, 71, 92];
  const activeChartIndex = Math.min(selectedChartIndex, Math.max(chartData.length - 1, 0));
  const selectedChartItem = chartData[activeChartIndex];
  const points = chartData.map((item, index) => {
    const x = 8 + (index * 84) / Math.max(chartData.length - 1, 1);
    const y = chartScale.max > 0 ? 92 - (item.value / chartScale.max) * 84 : 92;
    return {x, y, ...item};
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPath = hasChartRevenue ? `M ${points[0].x} 92 L ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${points[points.length - 1].x} 92 Z` : '';

  const greetingName = business?.name?.split(/\s+/)[0] || 'there';

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">Welcome back, {greetingName}. Here’s what’s happening with your business.</p>
        </div>
        <select aria-label="Dashboard period" value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)} className="ui-field w-full font-semibold sm:w-auto sm:min-w-44">
          {periodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const TrendIcon = stat.comparison.direction === 'up' ? FiArrowUp : stat.comparison.direction === 'down' ? FiArrowDown : FiArrowRight;
          const trendColor = stat.comparison.direction === 'up' ? 'text-emerald-600' : stat.comparison.direction === 'down' ? 'text-rose-600' : 'text-slate-400';
          return (
            <Card key={stat.label}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', stat.bg)}><Icon className={cn('h-5 w-5', stat.color)} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
                    <p className="mt-1 break-anywhere text-xl font-extrabold tracking-[-0.02em] text-slate-950 sm:text-2xl">{money(stat.value)}</p>
                    <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', trendColor)}>
                      <TrendIcon className="h-3.5 w-3.5" />
                      <span className="truncate">{stat.comparison.text}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Card>
          <div className="p-4 sm:p-5 lg:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="h-5 w-5 text-primary-600" />
                  <h2 className="text-base font-bold text-slate-950">Revenue Trend</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">Active payments received over the last six months.</p>
              </div>
              <div className="max-w-[45%] shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">6-month total</p>
                <p className="break-anywhere text-sm font-bold text-slate-900">{money(totalChartRevenue)}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-primary-50/60 to-white p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <span>Amount ({business?.currency || 'ZMW'})</span>
                {hasChartRevenue && <span className="normal-case tracking-normal">Select a month for details</span>}
              </div>
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2">
                <div className={cn('flex h-48 flex-col justify-between py-4 text-right text-[10px] font-medium leading-none text-slate-400 sm:h-56', !hasChartRevenue && 'invisible')} aria-hidden="true">
                  {chartScale.ticks.map((tick, index) => <span key={`${tick}-${index}`}>{compactAmount(tick)}</span>)}
                </div>
                <div className="relative min-w-0">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="h-48 w-full sm:h-56"
                    role="img"
                    aria-label={`Monthly revenue for the last six months: ${chartData.map((item) => `${item.label} ${money(item.value)}`).join(', ')}`}
                  >
                <defs>
                  <linearGradient id="dashboardArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.015" />
                  </linearGradient>
                </defs>
                {hasChartRevenue
                  ? chartGridY.map((y) => <line key={y} x1="3" x2="97" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.55" />)
                  : <line x1="3" x2="97" y1="92" y2="92" stroke="#cbd5e1" strokeWidth="0.7" strokeDasharray="2 2" />}
                {areaPath && <path d={areaPath} fill="url(#dashboardArea)" />}
                {hasChartRevenue && polyline && <polyline points={polyline} fill="none" stroke="#6536f6" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                {hasChartRevenue && points.map((point, index) => (
                  <g key={`${point.year}-${point.month}`}>
                    <circle cx={point.x} cy={point.y} r="2.6" fill="white" />
                    {index === activeChartIndex && <circle cx={point.x} cy={point.y} r="3.5" fill="none" stroke="#6536f6" strokeOpacity="0.22" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
                    <circle cx={point.x} cy={point.y} r={index === activeChartIndex ? '2' : '1.65'} fill="#6536f6" stroke="white" strokeWidth="0.4">
                      <title>{`${point.label}: ${money(point.value)}`}</title>
                    </circle>
                  </g>
                ))}
                  </svg>
                  {!hasChartRevenue && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center">
                      <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">No active payments in the last six months</span>
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-6 gap-1 px-1 text-center text-[10px] font-medium text-slate-500 sm:text-xs">
                    {chartData.map((item) => <span key={`${item.year}-${item.month}`}>{item.label}</span>)}
                  </div>
                </div>
              </div>
              {hasChartRevenue && selectedChartItem && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-white/85 px-3 py-2.5 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Selected month</p>
                    <p className="truncate text-sm font-bold text-slate-900">{selectedChartItem.label} {selectedChartItem.year}</p>
                  </div>
                  <p className="shrink-0 text-base font-extrabold text-primary-700">{money(selectedChartItem.value)}</p>
                </div>
              )}
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Select revenue month">
                {chartData.map((item, index) => (
                  <button
                    key={`${item.year}-${item.month}-selector`}
                    type="button"
                    aria-pressed={activeChartIndex === index}
                    onClick={() => setSelectedChartIndex(index)}
                    className={cn(
                      'min-w-[4.75rem] shrink-0 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      activeChartIndex === index ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-slate-200 bg-white text-slate-600 hover:border-primary-100 hover:bg-primary-50/50',
                    )}
                  >
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">{item.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-bold">{money(item.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 sm:p-5 lg:p-6">
            <div className="mb-4 flex items-center gap-2">
              <FiZap className="h-5 w-5 text-primary-600" />
              <div>
                <h2 className="text-base font-bold text-slate-950">Quick Actions</h2>
                <p className="text-xs text-slate-500">Create and manage your business records.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => navigate('/invoices/new')} className="col-span-2 flex items-center justify-between rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-4 text-left text-white shadow-[0_12px_24px_rgba(91,52,245,0.2)] transition-transform hover:-translate-y-0.5">
                <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><FiFileText className="h-5 w-5" /></span><span className="text-sm font-semibold">Create Invoice</span></span>
                <FiArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => navigate('/receipts/new')} className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50/60 p-4 text-left text-primary-900 transition-colors hover:bg-primary-50">
                <span className="flex items-center gap-3"><FiFile className="h-5 w-5 text-primary-600" /><span className="text-sm font-semibold">Receipt</span></span><FiArrowRight className="h-4 w-4 text-primary-600" />
              </button>
              <button type="button" onClick={() => navigate('/customers/new')} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-800 transition-colors hover:bg-slate-50">
                <span className="flex items-center gap-3"><FiUsers className="h-5 w-5 text-primary-600" /><span className="text-sm font-semibold">Customer</span></span><FiArrowRight className="h-4 w-4 text-slate-400" />
              </button>
              <button type="button" onClick={() => navigate('/items/new')} className="col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-800 transition-colors hover:bg-slate-50">
                <span className="flex items-center gap-3"><FiPackage className="h-5 w-5 text-primary-600" /><span className="text-sm font-semibold">Add Product / Service</span></span><FiArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Recent Invoices & Receipts</h2>
              <p className="mt-1 text-xs text-slate-500">Your latest documents in the selected reporting period.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-64">
                <FiSearch className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search documents..." aria-label="Search recent documents" className="ui-field ui-field-with-icon" />
              </div>
              <button type="button" onClick={() => navigate('/documents')} className="ui-secondary-button whitespace-nowrap text-primary-700">View All <FiArrowRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {quickFilters.map((filter) => (
              <button key={filter} type="button" aria-pressed={activeFilter === filter} onClick={() => setActiveFilter(filter)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', activeFilter === filter ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{filter}</button>
            ))}
          </div>

          {filteredDocuments.length === 0 ? (
            <EmptyState title="No documents found" description="No documents match the selected period and filter." icon={<FiFileText className="text-slate-300" />} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      <th scope="col" className="border-b border-slate-100 px-3 py-3">Document</th>
                      <th scope="col" className="border-b border-slate-100 px-3 py-3">Customer</th>
                      <th scope="col" className="border-b border-slate-100 px-3 py-3">Date</th>
                      <th scope="col" className="border-b border-slate-100 px-3 py-3 text-right">Amount</th>
                      <th scope="col" className="border-b border-slate-100 px-3 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map((document) => (
                      <tr key={`${document.type}-${document.id}`} tabIndex={0} role="link" onClick={() => navigate(document.path)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(document.path); } }} className="cursor-pointer text-sm transition-colors hover:bg-slate-50/70 focus-visible:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500">
                        <td className="border-b border-slate-100 px-3 py-3.5"><p className="font-semibold text-slate-900">{document.number}</p><p className="mt-0.5 text-xs text-slate-400">{document.type}</p></td>
                        <td className="border-b border-slate-100 px-3 py-3.5 font-medium text-slate-700">{document.customer || 'No customer'}</td>
                        <td className="border-b border-slate-100 px-3 py-3.5 text-slate-500">{formatDate(document.date)}</td>
                        <td className="border-b border-slate-100 px-3 py-3.5 text-right font-semibold text-slate-900">{money(document.amount)}</td>
                        <td className="border-b border-slate-100 px-3 py-3.5 text-right"><DocumentStatusBadge document={document} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 md:hidden">
                {filteredDocuments.map((document) => (
                  <button key={`${document.type}-${document.id}`} type="button" onClick={() => navigate(document.path)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{document.customer || document.number}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{document.number} · {formatDate(document.date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">{money(document.amount)}</p>
                      <span className="mt-1 inline-flex"><DocumentStatusBadge document={document} /></span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
