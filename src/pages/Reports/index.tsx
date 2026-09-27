import {useMemo, useState} from 'react';
import {
  FiArrowDownRight,
  FiArrowUpRight,
  FiCalendar,
  FiDollarSign,
  FiFileText,
  FiRefreshCcw,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {cn, formatCurrency} from '../../utils/helpers';
import {
  buildInvoiceStatusBreakdown,
  buildPaymentMethodBreakdown,
  buildReceivablesAging,
  buildTopCustomers,
  calculateReportChange,
  calculateReportMetrics,
  getPreviousReportPeriodRange,
  getReportPeriodRange,
  type ReportPeriod,
} from '../../utils/reports';
import Card from '../../components/Card';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';

const PERIODS: ReportPeriod[] = ['Today', 'This Week', 'This Month', 'This Quarter', 'This Year', 'All Time'];

function ChangeBadge({value}: {value: number | null}) {
  if (value === null) return <span className="text-xs font-medium text-slate-400">No prior baseline</span>;
  if (value === 0) return <span className="text-xs font-medium text-slate-400">No change</span>;
  const positive = value > 0;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
      {positive ? <FiArrowUpRight className="h-3.5 w-3.5" /> : <FiArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(value)}% vs previous
    </span>
  );
}

function MetricCard({label, value, icon: Icon, tone, change, note}: {
  label: string;
  value: string;
  icon: typeof FiDollarSign;
  tone: string;
  change?: number | null;
  note?: string;
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-xl font-bold tracking-[-0.02em] text-slate-950 sm:text-2xl">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="h-5 w-5" /></div>
      </div>
      {change !== undefined ? <div className="mt-3"><ChangeBadge value={change} /></div> : null}
      {note ? <p className="mt-2 text-xs leading-5 text-slate-400">{note}</p> : null}
    </Card>
  );
}

function SectionHeading({title, description}: {title: string; description?: string}) {
  return <div className="mb-4"><h2 className="text-base font-bold text-slate-950">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>;
}

export default function Reports() {
  const {invoices, customers, receipts, payments, quotations, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const [period, setPeriod] = useState<ReportPeriod>('This Month');
  const now = Date.now();

  const range = useMemo(() => getReportPeriodRange(period, now), [period, now]);
  const previousRange = useMemo(() => getPreviousReportPeriodRange(period, now), [period, now]);
  const stats = useMemo(() => calculateReportMetrics(invoices, payments, receipts, quotations, customers, range, now), [invoices, payments, receipts, quotations, customers, range, now]);
  const previousStats = useMemo(() => previousRange ? calculateReportMetrics(invoices, payments, receipts, quotations, customers, previousRange, previousRange.end) : null, [invoices, payments, receipts, quotations, customers, previousRange]);
  const topCustomers = useMemo(() => buildTopCustomers(customers, invoices, payments, range, 5), [customers, invoices, payments, range]);
  const paymentMethods = useMemo(() => buildPaymentMethodBreakdown(payments, range), [payments, range]);
  const aging = useMemo(() => buildReceivablesAging(invoices, now), [invoices, now]);
  const statusBreakdown = useMemo(() => buildInvoiceStatusBreakdown(invoices, range), [invoices, range]);

  const salesChange = previousStats ? calculateReportChange(stats.sales, previousStats.sales) : undefined;
  const netCashChange = previousStats ? calculateReportChange(stats.netCash, previousStats.netCash) : undefined;
  const maxMethodAmount = Math.max(...paymentMethods.map((row) => Math.abs(row.netCash)), 1);
  const maxAgingAmount = Math.max(...aging.map((row) => row.amount), 1);

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <PageHeader
        eyebrow="Analytics"
        title="Reports & Analytics"
        description="Understand invoice performance, cash collections, receivables and customer activity without changing historical records."
        actions={
          <select aria-label="Report period" value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)} className="ui-field min-w-44">
            {PERIODS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        }
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 sm:hidden">
        {PERIODS.map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={cn('shrink-0 rounded-full px-3 py-2 text-xs font-semibold', period === value ? 'bg-primary-600 text-white' : 'border border-slate-200 bg-white text-slate-600')}>{value}</button>)}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sales invoiced" value={money(stats.sales)} icon={FiTrendingUp} tone="bg-primary-50 text-primary-600" change={salesChange} note={`${stats.invoiceCount} invoice${stats.invoiceCount === 1 ? '' : 's'} issued in this period`} />
        <MetricCard label="Net collections" value={money(stats.netCash)} icon={FiDollarSign} tone="bg-emerald-50 text-emerald-600" change={netCashChange} note={`${money(stats.grossCollections)} received − ${money(stats.reversals)} reversed`} />
        <MetricCard label="Outstanding" value={money(stats.outstanding)} icon={FiFileText} tone="bg-amber-50 text-amber-600" note="Current remaining balance on invoices issued in this period" />
        <MetricCard label="Overdue" value={money(stats.overdue)} icon={FiFileText} tone="bg-rose-50 text-rose-600" note="Current overdue portion of the selected invoice cohort" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          {label: 'Avg invoice', value: money(stats.averageInvoiceValue), icon: FiTrendingUp},
          {label: 'New customers', value: String(stats.newCustomerCount), icon: FiUsers},
          {label: 'Active receipts', value: String(stats.receiptCount), icon: FiFileText},
          {label: 'Quotations', value: String(stats.quotationCount), icon: FiFileText},
          {label: 'Net invoiced', value: money(stats.netInvoiced), icon: FiCalendar},
        ].map(({label, value, icon: Icon}) => (
          <Card key={label} className="p-3.5 sm:p-4">
            <div className="mb-2 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-primary-600"><Icon className="h-4 w-4" /></span><span className="text-xs font-medium text-slate-500">{label}</span></div>
            <p className="truncate text-base font-bold text-slate-950 sm:text-lg">{value}</p>
          </Card>
        ))}
      </div>

      {(stats.reversals > 0 || stats.voidedReceiptCount > 0 || stats.cancellationAdjustments > 0) && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600"><FiRefreshCcw className="h-5 w-5" /></span>
          <div><p className="font-semibold text-amber-950">Corrections in this period</p><p className="mt-1 text-sm leading-6 text-amber-800">{money(stats.cancellationAdjustments)} in invoice cancellations, {money(stats.reversals)} in payment reversals, and {stats.voidedReceiptCount} voided receipt{stats.voidedReceiptCount === 1 ? '' : 's'}. Invoice cancellations reduce Net invoiced in their cancellation period; payment reversals reduce Net collections in their reversal period.</p></div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <SectionHeading title="Payment methods" description={`Net recorded collections by method for ${period.toLowerCase()}.`} />
          {paymentMethods.length === 0 ? <EmptyState icon={<FiDollarSign className="h-7 w-7" />} title="No payment activity" description="There are no payment transactions in the selected reporting period." /> : (
            <div className="space-y-5">
              {paymentMethods.map((row) => (
                <div key={row.method}>
                  <div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{row.label}</span><span className={cn('font-bold', row.netCash < 0 ? 'text-rose-600' : 'text-slate-950')}>{money(row.netCash)}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-indigo-500" style={{width: `${Math.max((Math.abs(row.netCash) / maxMethodAmount) * 100, row.netCash === 0 ? 0 : 3)}%`}} /></div>
                  <p className="mt-1.5 text-xs text-slate-400">{row.transactionCount} payment{row.transactionCount === 1 ? '' : 's'} · {money(row.reversals)} reversed</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionHeading title="Receivables aging" description="Current outstanding balances across all active invoices." />
          <div className="space-y-5">
            {aging.map((bucket) => (
              <div key={bucket.key}>
                <div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{bucket.label}</span><span className="font-bold text-slate-950">{money(bucket.amount)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{width: `${Math.max((bucket.amount / maxAgingAmount) * 100, bucket.amount === 0 ? 0 : 3)}%`}} /></div>
                <p className="mt-1.5 text-xs text-slate-400">{bucket.invoiceCount} invoice{bucket.invoiceCount === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <SectionHeading title="Top customers by sales" description="Customers contributing the most invoiced value in the selected period." />
          {topCustomers.length === 0 ? <EmptyState icon={<FiUsers className="h-7 w-7" />} title="No customer activity" description="Customer sales will appear here when invoices fall inside the selected period." /> : (
            <div className="divide-y divide-slate-100">
              {topCustomers.map((row, index) => (
                <div key={row.customerId} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700">{index + 1}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{row.customerName}</p><p className="mt-0.5 text-xs text-slate-400">{row.invoiceCount} invoice{row.invoiceCount === 1 ? '' : 's'} · {money(row.netCash)} collected</p></div></div>
                  <div className="shrink-0 text-right"><p className="text-sm font-bold text-slate-950">{money(row.sales)}</p><p className="mt-0.5 text-xs font-medium text-amber-600">{money(row.outstanding)} due</p></div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionHeading title="Invoice status mix" description="Current state of invoices issued in the selected period." />
          {statusBreakdown.length === 0 ? <EmptyState icon={<FiFileText className="h-7 w-7" />} title="No invoices in this period" description="Choose another reporting period to review invoice activity." /> : (
            <div className="space-y-2.5">
              {statusBreakdown.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div><StatusBadge status={row.status} /><p className="mt-1.5 text-xs text-slate-400">{row.count} invoice{row.count === 1 ? '' : 's'}</p></div>
                  <p className="font-bold text-slate-950">{money(row.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-xs leading-5 text-slate-400">
        Sales invoiced follows invoice issue dates and is not rewritten by a later cancellation. Cancellation adjustments follow cancellation dates; Net invoiced = Sales invoiced − cancellation adjustments. Collection activity follows payment and reversal dates. Outstanding and overdue are current balances for invoices issued in the selected period.
      </div>
    </div>
  );
}
