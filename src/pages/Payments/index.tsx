import {useEffect, useMemo, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiRefreshCcw,
  FiRotateCcw,
  FiSearch,
} from 'react-icons/fi';
import {toast} from 'react-hot-toast';
import {useStore} from '../../store/useStore';
import {cn, formatCurrency, formatDate, getInvoiceStatus, getPaymentMethodLabel, isPaymentReversed} from '../../utils/helpers';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

const paymentMethods = [
  ['cash', 'Cash'],
  ['bank_transfer', 'Bank Transfer'],
  ['mtn_money', 'MTN Mobile Money'],
  ['airtel_money', 'Airtel Money'],
  ['zamtel_money', 'Zamtel Money'],
  ['card', 'Card'],
  ['cheque', 'Cheque'],
] as const;

type HistoryFilter = 'all' | 'active' | 'reversed';

export default function Payments() {
  const [searchParams] = useSearchParams();
  const {invoices, payments, recordPayment, reversePayment, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (value: number) => formatCurrency(value, currency);
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(toDateInput(Date.now()));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [createReceipt, setCreateReceipt] = useState(true);
  const [query, setQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [reverseTarget, setReverseTarget] = useState<{id: string; label: string} | null>(null);

  const unpaidInvoices = useMemo(
    () => invoices.filter((invoice) => !['paid', 'cancelled', 'draft'].includes(getInvoiceStatus(invoice))),
    [invoices],
  );
  const selected = invoices.find((invoice) => invoice.id === selectedInvoice);
  const outstanding = selected ? Math.max(selected.grandTotal - selected.amountPaid, 0) : 0;

  const activePayments = useMemo(() => payments.filter((payment) => !isPaymentReversed(payment)), [payments]);
  const reversedPayments = useMemo(() => payments.filter((payment) => isPaymentReversed(payment)), [payments]);
  const collected = useMemo(() => activePayments.reduce((sum, payment) => sum + payment.amount, 0), [activePayments]);
  const reversedTotal = useMemo(() => reversedPayments.reduce((sum, payment) => sum + payment.amount, 0), [reversedPayments]);

  const visiblePayments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return payments.filter((payment) => {
      const reversed = isPaymentReversed(payment);
      if (historyFilter === 'active' && reversed) return false;
      if (historyFilter === 'reversed' && !reversed) return false;
      if (!normalized) return true;
      const invoice = invoices.find((candidate) => candidate.id === payment.invoiceId);
      return [payment.customerName, payment.referenceNumber, getPaymentMethodLabel(payment.method), invoice?.number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [historyFilter, invoices, payments, query]);

  useEffect(() => {
    const requestedInvoice = searchParams.get('invoice');
    if (requestedInvoice && unpaidInvoices.some((invoice) => invoice.id === requestedInvoice)) setSelectedInvoice(requestedInvoice);
  }, [searchParams, unpaidInvoices]);

  const handleRecord = () => {
    const numericAmount = Number(amount);
    if (!selectedInvoice) {
      toast.error('Select an invoice.');
      return;
    }
    if (!amount.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error('Enter a valid payment amount greater than 0.');
      return;
    }
    if (!paymentDate) {
      toast.error('Select the payment date.');
      return;
    }

    const result = recordPayment({
      invoiceId: selectedInvoice,
      amount: numericAmount,
      date: parseDateInput(paymentDate),
      method,
      referenceNumber: reference,
      notes,
      createReceipt,
    });

    if (!result.success) {
      toast.error(result.error ?? 'Payment could not be recorded.');
      return;
    }

    const receiptText = result.receipt ? ` Receipt ${result.receipt.number} created.` : '';
    toast.success(`${money(result.payment?.amount ?? numericAmount)} received from ${result.payment?.customerName ?? selected?.customerName}.${receiptText}`);
    setAmount('');
    setReference('');
    setNotes('');
    setSelectedInvoice('');
    setPaymentDate(toDateInput(Date.now()));
  };

  const confirmReverse = (reason: string) => {
    if (!reverseTarget) return;
    const result = reversePayment({paymentId: reverseTarget.id, reason});
    if (!result.success) {
      toast.error(result.error ?? 'Payment could not be reversed.');
      return;
    }
    setReverseTarget(null);
    toast.success('Payment reversed. The original transaction remains in the audit history.');
  };

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Record collections, monitor balances and keep a clear audit trail of reversals."
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Collected</p><p className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">{money(collected)}</p><p className="mt-1 text-xs text-slate-500">Active payment history</p></div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FiDollarSign className="h-5 w-5" /></span>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Open invoices</p><p className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">{unpaidInvoices.length}</p><p className="mt-1 text-xs text-slate-500">Ready to receive payment</p></div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiClock className="h-5 w-5" /></span>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Reversed</p><p className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">{money(reversedTotal)}</p><p className="mt-1 text-xs text-slate-500">{reversedPayments.length} reversal{reversedPayments.length === 1 ? '' : 's'} retained</p></div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><FiRefreshCcw className="h-5 w-5" /></span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)]">
        <Card className="self-start p-4 sm:p-6 xl:sticky xl:top-4">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiCreditCard className="h-5 w-5" /></span>
            <div><h2 className="text-lg font-bold text-slate-950">Record payment</h2><p className="text-sm text-slate-500">Apply a payment to an outstanding invoice.</p></div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="ui-label">Invoice *</label>
              <select aria-label="Invoice to receive payment for" value={selectedInvoice} onChange={(event) => setSelectedInvoice(event.target.value)} className="ui-field">
                <option value="">Select invoice</option>
                {unpaidInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>{invoice.number} — {invoice.customerName} ({money(Math.max(invoice.grandTotal - invoice.amountPaid, 0))} due)</option>
                ))}
              </select>
            </div>

            {selected && (
              <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div><p className="text-sm font-bold text-slate-900">{selected.number}</p><p className="text-xs text-slate-500">{selected.customerName}</p></div>
                  <StatusBadge status={getInvoiceStatus(selected)} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/80 p-2"><p className="text-[11px] text-slate-400">Total</p><p className="mt-1 text-sm font-bold text-slate-900">{money(selected.grandTotal)}</p></div>
                  <div className="rounded-xl bg-white/80 p-2"><p className="text-[11px] text-slate-400">Paid</p><p className="mt-1 text-sm font-bold text-emerald-600">{money(selected.amountPaid)}</p></div>
                  <div className="rounded-xl bg-white/80 p-2"><p className="text-[11px] text-slate-400">Due</p><p className="mt-1 text-sm font-bold text-primary-700">{money(outstanding)}</p></div>
                </div>
              </div>
            )}

            <div>
              <label className="ui-label">Amount received *</label>
              <div className="relative"><FiDollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="number" aria-label="Amount received" min="0.01" step="0.01" max={selected ? outstanding : undefined} value={amount} onChange={(event) => setAmount(event.target.value)} className={cn('ui-field ui-field-with-icon', amount && Number(amount) > outstanding && selected && 'border-rose-400 focus:border-rose-500')} placeholder="0.00" /></div>
              {selected && <p className="mt-1.5 text-xs text-slate-400">Maximum available balance: {money(outstanding)}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div><label className="ui-label">Payment method *</label><select aria-label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)} className="ui-field">{paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div><label className="ui-label">Payment date *</label><input type="date" aria-label="Payment date" max={toDateInput(Date.now())} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="ui-field" /></div>
            </div>

            <div><label className="ui-label">Reference number</label><input type="text" aria-label="Reference number" value={reference} onChange={(event) => setReference(event.target.value)} className="ui-field" placeholder="Bank, mobile money or cheque reference" /><p className="mt-1.5 text-xs leading-5 text-slate-400">A reference cannot be reused by another active payment on the same invoice.</p></div>
            <div><label className="ui-label">Notes</label><textarea aria-label="Payment notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="ui-field resize-y" placeholder="Optional payment note" /></div>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"><span><span className="block text-sm font-semibold text-slate-700">Generate receipt</span><span className="block text-xs text-slate-500">Create a linked receipt automatically.</span></span><input type="checkbox" aria-label="Generate receipt" checked={createReceipt} onChange={(event) => setCreateReceipt(event.target.checked)} className="h-4 w-4 rounded accent-primary-600" /></label>
            <button onClick={handleRecord} className="ui-primary-button w-full"><FiCheckCircle className="h-4 w-4" /> Record Payment</button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-lg font-bold text-slate-950">Payment history</h2><p className="text-sm text-slate-500">Search active and reversed transactions without losing the audit trail.</p></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 sm:w-64"><FiSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="ui-field ui-field-with-icon" placeholder="Search payments" aria-label="Search payment history" /></div>
                <select aria-label="Payment history filter" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as HistoryFilter)} className="ui-field sm:w-36"><option value="all">All history</option><option value="active">Active</option><option value="reversed">Reversed</option></select>
              </div>
            </div>
          </div>

          {visiblePayments.length === 0 ? (
            <EmptyState icon={<FiCreditCard className="h-7 w-7" />} title={payments.length === 0 ? 'No payments yet' : 'No matching payments'} description={payments.length === 0 ? 'Record your first payment using the form to start building a payment history.' : 'Try a different search term or history filter.'} />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-slate-50/80"><tr>{['Payment', 'Customer / Invoice', 'Method', 'Date', 'Status', 'Action'].map((heading) => <th scope="col" key={heading} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{heading}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {visiblePayments.map((payment) => {
                      const invoice = invoices.find((candidate) => candidate.id === payment.invoiceId);
                      const reversed = isPaymentReversed(payment);
                      return (
                        <tr key={payment.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3"><p className={cn('font-semibold text-slate-900', reversed && 'text-slate-400 line-through')}>{money(payment.amount)}</p>{payment.referenceNumber && <p className="mt-0.5 max-w-44 truncate text-xs text-slate-400">{payment.referenceNumber}</p>}</td>
                          <td className="px-4 py-3"><p className="text-sm font-medium text-slate-800">{payment.customerName}</p><p className="text-xs text-slate-400">{invoice?.number || 'Invoice unavailable'}</p></td>
                          <td className="px-4 py-3 text-sm text-slate-600">{getPaymentMethodLabel(payment.method)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(payment.date)}</td>
                          <td className="px-4 py-3"><StatusBadge status={reversed ? 'reversed' : 'active'} /></td>
                          <td className="px-4 py-3">{!reversed ? <button type="button" onClick={() => setReverseTarget({id: payment.id, label: money(payment.amount)})} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"><FiRotateCcw /> Reverse</button> : <span className="text-xs text-slate-400">Audit retained</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {visiblePayments.map((payment) => {
                  const invoice = invoices.find((candidate) => candidate.id === payment.invoiceId);
                  const reversed = isPaymentReversed(payment);
                  return (
                    <div key={payment.id} className="p-4">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className={cn('text-base font-bold text-slate-950', reversed && 'text-slate-400 line-through')}>{money(payment.amount)}</p><p className="mt-1 truncate text-sm font-medium text-slate-700">{payment.customerName}</p><p className="text-xs text-slate-400">{invoice?.number || 'Invoice unavailable'} · {formatDate(payment.date)}</p></div><StatusBadge status={reversed ? 'reversed' : 'active'} /></div>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"><div className="min-w-0"><p className="text-xs text-slate-400">Method</p><p className="truncate text-sm font-medium text-slate-700">{getPaymentMethodLabel(payment.method)}</p></div>{!reversed && <button type="button" onClick={() => setReverseTarget({id: payment.id, label: money(payment.amount)})} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600"><FiRotateCcw /> Reverse</button>}</div>
                      {reversed && payment.reversalReason && <p className="mt-2 text-xs leading-5 text-rose-600">Reason: {payment.reversalReason}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(reverseTarget)}
        title="Reverse payment?"
        description={reverseTarget ? `Reverse the ${reverseTarget.label} payment? The linked receipt will be voided and the invoice balance restored. The original transaction stays in the audit history.` : ''}
        confirmLabel="Reverse Payment"
        reasonLabel="Reason for reversal"
        reasonPlaceholder="Explain why this transaction is being reversed"
        reasonRequired
        onCancel={() => setReverseTarget(null)}
        onConfirm={confirmReverse}
      />
    </div>
  );
}
