import {useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FiArrowLeft, FiCalendar, FiCheck, FiCreditCard, FiDollarSign, FiFileText, FiHash, FiSave, FiUser} from 'react-icons/fi';
import {toast} from 'react-hot-toast';
import {useStore} from '../../store/useStore';
import {cn, formatCurrency, getInvoiceStatus, getPaymentMethodLabel} from '../../utils/helpers';
import PageHeader from '../../components/PageHeader';

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

const fallbackMethods = ['cash', 'bank_transfer', 'mtn_money', 'airtel_money', 'zamtel_money', 'card', 'cheque'];

export default function ReceiptForm() {
  const navigate = useNavigate();
  const {invoices, recordPayment, business, paymentMethods} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const availableMethods = paymentMethods.length > 0 ? paymentMethods.map((method) => method.type) : fallbackMethods;
  const [form, setForm] = useState({customerId: '', customerName: '', amount: '', date: toDateInput(Date.now()), method: availableMethods[0] || 'cash', referenceNumber: '', notes: '', linkedInvoice: ''});
  const [openReceiptAfterSave, setOpenReceiptAfterSave] = useState(true);

  const openInvoices = useMemo(() => invoices.filter((invoice) => !['paid', 'cancelled', 'draft'].includes(getInvoiceStatus(invoice))).sort((a, b) => b.issueDate - a.issueDate), [invoices]);
  const selectedInvoice = invoices.find((invoice) => invoice.id === form.linkedInvoice);
  const outstanding = selectedInvoice ? Math.max(selectedInvoice.grandTotal - selectedInvoice.amountPaid, 0) : 0;
  const numericAmount = Number(form.amount || 0);

  const handleInvoiceChange = (invoiceId: string) => {
    const invoice = invoices.find((candidate) => candidate.id === invoiceId);
    setForm((previous) => ({...previous, linkedInvoice: invoiceId, customerId: invoice?.customerId ?? previous.customerId, customerName: invoice?.customerName ?? previous.customerName, amount: invoice ? String(Math.max(invoice.grandTotal - invoice.amountPaid, 0)) : previous.amount}));
  };

  const handleSave = () => {
    const amount = Number(form.amount);
    if (!form.customerName.trim() || !form.amount.trim() || !form.date) {toast.error('Complete the required payment details.'); return;}
    if (!Number.isFinite(amount) || amount <= 0) {toast.error('Amount received must be greater than 0.'); return;}
    const result = recordPayment({invoiceId: form.linkedInvoice || undefined, customerId: form.customerId, customerName: form.customerName, amount, date: parseDateInput(form.date), method: form.method, referenceNumber: form.referenceNumber, notes: form.notes, createReceipt: true});
    if (!result.success || !result.receipt) {toast.error(result.error ?? 'Receipt could not be created.'); return;}
    toast.success(`Payment recorded and receipt ${result.receipt.number} created.`);
    navigate(openReceiptAfterSave ? `/receipts/${result.receipt.id}` : '/receipts');
  };

  return (
    <div className="mx-auto max-w-6xl">
      <button type="button" onClick={() => navigate('/receipts')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><FiArrowLeft /> Back to receipts</button>
      <PageHeader title="Record Payment & Create Receipt" description="Record a payment safely and generate its linked receipt in one step." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
            <div className="mb-5"><h2 className="ui-section-title">Link to an invoice</h2><p className="mt-1 text-sm text-slate-500">Choose an outstanding invoice, or leave this blank for a standalone receipt.</p></div>
            <label className="ui-label">Outstanding invoice</label>
            <div className="relative"><FiFileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select aria-label="Linked invoice" value={form.linkedInvoice} onChange={(event) => handleInvoiceChange(event.target.value)} className="ui-field ui-field-with-icon"><option value="">None — standalone receipt</option>{openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} — {invoice.customerName} ({money(Math.max(invoice.grandTotal - invoice.amountPaid, 0))} outstanding)</option>)}</select></div>

            {selectedInvoice && <div className="mt-4 grid gap-3 rounded-xl border border-primary-100 bg-primary-50/50 p-4 sm:grid-cols-3"><div><p className="text-xs font-semibold text-slate-400">Invoice</p><p className="mt-1 text-sm font-bold text-slate-900">{selectedInvoice.number}</p></div><div><p className="text-xs font-semibold text-slate-400">Customer</p><p className="mt-1 text-sm font-bold text-slate-900 break-anywhere">{selectedInvoice.customerName}</p></div><div><p className="text-xs font-semibold text-slate-400">Outstanding</p><p className="mt-1 text-sm font-bold text-primary-700">{money(outstanding)}</p></div></div>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
            <div className="mb-5"><h2 className="ui-section-title">Payment details</h2><p className="mt-1 text-sm text-slate-500">Enter what was received and how it was paid.</p></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><label className="ui-label">Received from <span className="text-rose-500">*</span></label><div className="relative"><FiUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" aria-label="Received from" value={form.customerName} disabled={Boolean(selectedInvoice)} onChange={(event) => setForm((previous) => ({...previous, customerName: event.target.value}))} placeholder="Customer or payer name" className="ui-field ui-field-with-icon disabled:bg-slate-50 disabled:text-slate-600" /></div></div>
              <div><label className="ui-label">Amount received <span className="text-rose-500">*</span></label><div className="relative"><FiDollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="number" aria-label="Amount received" min="0.01" step="0.01" max={selectedInvoice ? outstanding : undefined} value={form.amount} onChange={(event) => setForm((previous) => ({...previous, amount: event.target.value}))} className={cn('ui-field ui-field-with-icon', selectedInvoice && numericAmount > outstanding && 'border-rose-400')} /></div>{selectedInvoice && <p className="mt-1.5 text-xs text-slate-400">Maximum payment: {money(outstanding)}</p>}</div>
              <div><label className="ui-label">Payment date <span className="text-rose-500">*</span></label><div className="relative"><FiCalendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="date" aria-label="Payment date" max={toDateInput(Date.now())} value={form.date} onChange={(event) => setForm((previous) => ({...previous, date: event.target.value}))} className="ui-field ui-field-with-icon" /></div></div>
            </div>

            <div className="mt-5"><label className="ui-label">Payment method <span className="text-rose-500">*</span></label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{Array.from(new Set(availableMethods)).map((method) => <button key={method} type="button" aria-pressed={form.method === method} onClick={() => setForm((previous) => ({...previous, method}))} className={cn('flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all', form.method === method ? 'border-primary-300 bg-primary-50 text-primary-700 ring-2 ring-primary-100' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}><FiCreditCard className="shrink-0" /><span className="truncate">{getPaymentMethodLabel(method)}</span>{form.method === method && <FiCheck className="ml-auto shrink-0" />}</button>)}</div></div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"><div><label className="ui-label">Reference number</label><div className="relative"><FiHash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" aria-label="Reference number" value={form.referenceNumber} onChange={(event) => setForm((previous) => ({...previous, referenceNumber: event.target.value}))} placeholder="Transaction / cheque / deposit reference" className="ui-field ui-field-with-icon" /></div></div><div className="md:row-span-2"><label className="ui-label">Notes</label><textarea aria-label="Notes" value={form.notes} onChange={(event) => setForm((previous) => ({...previous, notes: event.target.value}))} rows={4} placeholder="Optional payment note" className="ui-field min-h-28 resize-y" /></div></div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiCreditCard /></span><div><h2 className="font-bold text-slate-950">Receipt summary</h2><p className="text-xs text-slate-500">Review before recording</p></div></div>
            <div className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Received from</span><span className="max-w-[55%] text-right font-semibold text-slate-900 break-anywhere">{form.customerName || '—'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Method</span><span className="text-right font-semibold text-slate-900">{getPaymentMethodLabel(form.method)}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Date</span><span className="text-right font-semibold text-slate-900">{form.date || '—'}</span></div></div>
            <div className="py-5"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Amount received</p><p className="mt-1 text-3xl font-bold tracking-[-0.03em] text-primary-700">{money(numericAmount)}</p>{selectedInvoice && <p className="mt-2 text-xs text-slate-500">Invoice balance after payment: <span className="font-semibold text-slate-700">{money(Math.max(outstanding - numericAmount, 0))}</span></p>}</div>
            <label className="mb-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><input type="checkbox" aria-label="Open receipt after saving" checked={openReceiptAfterSave} onChange={(event) => setOpenReceiptAfterSave(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600" /><span><span className="block font-semibold text-slate-700">Open receipt after saving</span><span className="mt-0.5 block text-xs text-slate-400">Review or share the generated receipt immediately.</span></span></label>
            <button type="button" onClick={handleSave} className="ui-primary-button w-full"><FiSave /> Record Payment & Receipt</button>
            <button type="button" onClick={() => navigate('/receipts')} className="ui-secondary-button mt-2 w-full">Cancel</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
