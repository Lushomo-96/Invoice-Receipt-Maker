import {useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {FiArrowLeft, FiCalendar, FiFileText, FiPlus, FiSave, FiSend, FiTrash2, FiUser} from 'react-icons/fi';
import {toast} from 'react-hot-toast';
import {useStore} from '../../store/useStore';
import {calculateTotals, formatCurrency, generateDocumentNumber, generateId, getQuotationEditLockReason, recalculateInvoiceItem, roundMoney} from '../../utils/helpers';
import type {InvoiceItem, Quotation} from '../../types';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';

interface FormData {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTpin: string;
  items: InvoiceItem[];
  discount: number;
  issueDate: string;
  expiryDate: string;
  notes: string;
  terms: string;
}

const emptyItem = (tax = 0, taxInclusive = false): InvoiceItem => ({itemId: '', name: '', description: '', quantity: 1, unitPrice: 0, discount: 0, tax, taxInclusive, amount: 0});

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, endOfDay = false): number {
  const [year, month, day] = value.split('-').map(Number);
  return endOfDay ? new Date(year, month - 1, day, 23, 59, 59, 999).getTime() : new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function addDays(value: string, days: number): string {
  const date = new Date(parseDateInput(value));
  date.setDate(date.getDate() + days);
  return toDateInput(date.getTime());
}

export default function QuotationForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const {id} = useParams();
  const {quotations, customers, items: masterItems, addQuotation, updateQuotation, setQuotationStatus, settings, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);
  const today = toDateInput(Date.now());
  const existingQuotation = useMemo(() => (id ? quotations.find((quotation) => quotation.id === id) : undefined), [id, quotations]);
  const editLockReason = existingQuotation ? getQuotationEditLockReason(existingQuotation) : null;
  const displayedNumber = existingQuotation?.number ?? generateDocumentNumber(settings.document.quotationPrefix, quotations.map((quotation) => quotation.number));

  const [form, setForm] = useState<FormData>({customerId: '', customerName: '', customerPhone: '', customerAddress: '', customerTpin: '', items: [emptyItem(settings.financial.defaultTaxRate, settings.financial.defaultTaxInclusive)], discount: 0, issueDate: today, expiryDate: addDays(today, settings.document.defaultQuotationValidityDays), notes: '', terms: ''});

  useEffect(() => {
    if (!existingQuotation) return;
    const customer = customers.find((candidate) => candidate.id === existingQuotation.customerId);
    setForm({customerId: existingQuotation.customerId, customerName: existingQuotation.customerName, customerPhone: existingQuotation.customerPhone ?? customer?.phone ?? '', customerAddress: existingQuotation.customerAddress ?? customer?.address ?? '', customerTpin: existingQuotation.customerTpin ?? customer?.tpin ?? '', items: existingQuotation.items.map((item) => recalculateInvoiceItem({...item, taxInclusive: item.taxInclusive ?? false})), discount: existingQuotation.discount, issueDate: toDateInput(existingQuotation.issueDate), expiryDate: toDateInput(existingQuotation.expiryDate), notes: existingQuotation.notes, terms: existingQuotation.terms});
  }, [customers, existingQuotation]);

  const {subtotal, totalTax, addedTax, includedTax, itemsTotal} = useMemo(() => calculateTotals(form.items), [form.items]);
  const total = roundMoney(Math.max(itemsTotal - form.discount, 0));

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((candidate) => candidate.id === customerId);
    if (!customer) {setForm((previous) => ({...previous, customerId: '', customerName: '', customerPhone: '', customerAddress: '', customerTpin: ''})); return;}
    setForm((previous) => ({...previous, customerId: customer.id, customerName: customer.name, customerPhone: customer.phone, customerAddress: customer.address, customerTpin: customer.tpin}));
  };

  useEffect(() => {
    if (id || existingQuotation) return;
    const preselectedCustomerId = (location.state as {customerId?: string} | null)?.customerId;
    if (preselectedCustomerId) handleCustomerSelect(preselectedCustomerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, id]);

  const updateItem = <K extends keyof InvoiceItem>(index: number, field: K, value: InvoiceItem[K]) => setForm((previous) => ({...previous, items: previous.items.map((item, itemIndex) => itemIndex === index ? recalculateInvoiceItem({...item, [field]: value}) : item)}));

  const chooseMasterItem = (index: number, itemId: string) => {
    const master = masterItems.find((item) => item.id === itemId);
    if (!master) {updateItem(index, 'itemId', ''); return;}
    setForm((previous) => ({...previous, items: previous.items.map((item, itemIndex) => itemIndex === index ? recalculateInvoiceItem({...item, itemId: master.id, name: master.name, description: master.description, unitPrice: master.price, tax: master.tax, taxInclusive: master.taxInclusive}) : item)}));
  };

  const validate = (allowIncompleteDraft: boolean): string | null => {
    if (!form.issueDate || !form.expiryDate) return 'Issue date and expiry date are required.';
    const issueDate = parseDateInput(form.issueDate);
    const expiryDate = parseDateInput(form.expiryDate, true);
    if (!Number.isFinite(issueDate) || !Number.isFinite(expiryDate)) return 'Enter valid quotation dates.';
    if (expiryDate < issueDate) return 'Expiry date cannot be earlier than the issue date.';
    if (!allowIncompleteDraft && (!form.customerId || !form.customerName.trim())) return 'Select a customer before sending the quotation.';
    for (let index = 0; index < form.items.length; index += 1) {
      const item = form.items[index];
      const label = `Item ${index + 1}`;
      const hasEnteredData = Boolean(item.name.trim()) || item.unitPrice !== 0 || item.discount !== 0 || item.tax !== 0 || item.quantity !== 1;
      if (allowIncompleteDraft && !hasEnteredData) continue;
      if (!item.name.trim()) return `${label} needs a name.`;
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return `${label} quantity must be greater than 0.`;
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) return `${label} unit price cannot be negative.`;
      if (!Number.isFinite(item.discount) || item.discount < 0) return `${label} discount cannot be negative.`;
      if (item.discount > item.quantity * item.unitPrice) return `${label} discount cannot exceed its line subtotal.`;
      if (!Number.isFinite(item.tax) || item.tax < 0 || item.tax > 100) return `${label} tax must be between 0% and 100%.`;
    }
    if (!Number.isFinite(form.discount) || form.discount < 0) return 'Quotation discount cannot be negative.';
    if (form.discount > itemsTotal) return 'Quotation discount cannot exceed the items total.';
    if (!allowIncompleteDraft && total <= 0) return 'Quotation total must be greater than 0.';
    return null;
  };

  const save = (send: boolean) => {
    const allowIncompleteDraft = !send && (!existingQuotation || existingQuotation.status === 'draft');
    const validationError = validate(allowIncompleteDraft);
    if (validationError) {toast.error(validationError); return;}
    const now = Date.now();
    const quotation: Quotation = {id: existingQuotation?.id ?? generateId(), number: displayedNumber, customerId: form.customerId, customerName: form.customerName, customerPhone: form.customerPhone, customerAddress: form.customerAddress, customerTpin: form.customerTpin, items: form.items.map(recalculateInvoiceItem), subtotal, discount: roundMoney(form.discount), tax: totalTax, total, issueDate: parseDateInput(form.issueDate), expiryDate: parseDateInput(form.expiryDate, true), notes: form.notes, terms: form.terms, status: existingQuotation?.status ?? (send ? 'sent' : 'draft'), convertedInvoiceId: existingQuotation?.convertedInvoiceId, convertedAt: existingQuotation?.convertedAt, createdAt: existingQuotation?.createdAt ?? now, updatedAt: now};

    if (existingQuotation) {
      const result = updateQuotation(quotation);
      if (!result.success) {toast.error(result.error ?? 'Unable to update quotation.'); return;}
      if (send && existingQuotation.status === 'draft') {
        const statusResult = setQuotationStatus(existingQuotation.id, 'sent');
        if (!statusResult.success) {toast.error(statusResult.error ?? 'Quotation saved, but could not be marked sent.'); navigate(`/quotations/${existingQuotation.id}`); return;}
      }
      if (!send && existingQuotation.status !== 'draft' && result.quotation?.status === 'draft') toast.success('Quotation revised and moved to Draft. Send it again before acceptance.');
      else toast.success(send ? 'Quotation saved and marked sent' : 'Quotation updated');
      navigate(`/quotations/${existingQuotation.id}`);
      return;
    }

    const result = addQuotation(quotation);
    if (!result.success) {toast.error(result.error ?? 'Unable to create quotation.'); return;}
    toast.success(send ? 'Quotation created and marked sent' : 'Quotation draft saved');
    navigate(`/quotations/${quotation.id}`);
  };

  if (id && !existingQuotation) return <EmptyState title="Quotation not found" description="The quotation may have been removed or the link is invalid." action={{label: 'Back to Quotations', onClick: () => navigate('/quotations')}} />;
  if (existingQuotation && editLockReason) return <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-soft"><h2 className="text-lg font-bold text-slate-950">Quotation editing is locked</h2><p className="mt-2 text-sm leading-6 text-slate-600">{editLockReason}</p><button type="button" onClick={() => navigate(`/quotations/${existingQuotation.id}`)} className="ui-primary-button mt-5">Back to Quotation</button></div>;

  const canSend = (existingQuotation?.status ?? 'draft') === 'draft';

  return (
    <div className="mx-auto max-w-7xl">
      <button type="button" onClick={() => navigate(existingQuotation ? `/quotations/${existingQuotation.id}` : '/quotations')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><FiArrowLeft /> Back to quotations</button>
      <PageHeader title={existingQuotation ? 'Edit Quotation' : 'Create Quotation'} description="Build a professional quotation, save it as a draft or mark it sent when it is ready for the customer." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiUser /></span><div><h2 className="ui-section-title">Customer & quotation details</h2><p className="mt-0.5 text-sm text-slate-500">Who the quotation is for and how long it remains valid.</p></div></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><label className="ui-label">Customer</label><div className="flex flex-col gap-2 sm:flex-row"><select aria-label="Customer" value={form.customerId} onChange={(event) => handleCustomerSelect(event.target.value)} className="ui-field flex-1"><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.businessName ? ` — ${customer.businessName}` : ''}</option>)}</select><button type="button" onClick={() => navigate('/customers/new', {state: {from: 'quotations'}})} className="ui-secondary-button shrink-0"><FiPlus /> New Customer</button></div>{form.customerName && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><p className="font-semibold text-slate-800">{form.customerName}</p><p className="mt-1 break-anywhere">{[form.customerAddress, form.customerPhone, form.customerTpin ? `TPIN ${form.customerTpin}` : ''].filter(Boolean).join(' · ') || 'No additional customer details'}</p></div>}</div>
              <div><label className="ui-label">Quotation number</label><div className="ui-field flex items-center bg-slate-50 font-semibold text-slate-600">{displayedNumber}</div></div>
              <div className="hidden md:block" />
              <div><label className="ui-label">Issue date</label><div className="relative"><FiCalendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="date" aria-label="Issue date" value={form.issueDate} onChange={(event) => setForm((previous) => ({...previous, issueDate: event.target.value}))} className="ui-field ui-field-with-icon" /></div></div>
              <div><label className="ui-label">Expiry date</label><div className="relative"><FiCalendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="date" aria-label="Expiry date" min={form.issueDate} value={form.expiryDate} onChange={(event) => setForm((previous) => ({...previous, expiryDate: event.target.value}))} className="ui-field ui-field-with-icon" /></div></div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5"><div><h2 className="ui-section-title">Quotation items</h2><p className="mt-1 text-sm text-slate-500">Choose a saved item or enter a custom line.</p></div><button type="button" onClick={() => setForm((previous) => ({...previous, items: [...previous.items, emptyItem(settings.financial.defaultTaxRate, settings.financial.defaultTaxInclusive)]}))} className="ui-secondary-button shrink-0"><FiPlus /> Add Item</button></div>
            <div className="divide-y divide-slate-100">
              {form.items.map((item, index) => (
                <div key={index} className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Item {index + 1}</p><button type="button" disabled={form.items.length <= 1} onClick={() => setForm((previous) => ({...previous, items: previous.items.filter((_, itemIndex) => itemIndex !== index)}))} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><FiTrash2 /></button></div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-5"><label className="ui-label">Saved item</label><select aria-label={`Saved item ${index + 1}`} value={item.itemId} onChange={(event) => chooseMasterItem(index, event.target.value)} className="ui-field"><option value="">Custom item</option>{masterItems.map((master) => <option key={master.id} value={master.id}>{master.name} — {money(master.price)}</option>)}</select></div>
                    <div className="md:col-span-7"><label className="ui-label">Item / description</label><input aria-label={`Item name ${index + 1}`} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Item name" className="ui-field" />{item.description && <p className="mt-1.5 text-xs text-slate-400 break-anywhere">{item.description}</p>}</div>
                    <div className="md:col-span-2"><label className="ui-label">Quantity</label><input type="number" aria-label={`Quantity for ${item.name || `item ${index + 1}`}`} min="0.01" step="any" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))} className="ui-field" /></div>
                    <div className="md:col-span-3"><label className="ui-label">Unit price</label><input type="number" aria-label={`Unit price for ${item.name || `item ${index + 1}`}`} min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', Number(event.target.value))} className="ui-field" /></div>
                    <div className="md:col-span-2"><label className="ui-label">Tax %</label><input type="number" aria-label={`Tax percentage for ${item.name || `item ${index + 1}`}`} min="0" max="100" step="0.01" value={item.tax} onChange={(event) => updateItem(index, 'tax', Number(event.target.value))} className="ui-field" /></div>
                    <div className="md:col-span-2"><label className="ui-label">Discount</label><input type="number" aria-label={`Discount for ${item.name || `item ${index + 1}`}`} min="0" step="0.01" value={item.discount} onChange={(event) => updateItem(index, 'discount', Number(event.target.value))} className="ui-field" /></div>
                    <div className="md:col-span-3"><label className="ui-label">Amount</label><div className="ui-field flex items-center justify-end bg-slate-50 font-bold text-slate-900">{money(item.amount)}</div></div>
                    <label className="md:col-span-12 flex items-center gap-2 text-xs font-medium text-slate-500"><input type="checkbox" aria-label={`Tax inclusive for ${item.name || `item ${index + 1}`}`} checked={item.taxInclusive ?? false} onChange={(event) => updateItem(index, 'taxInclusive', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600" /> Tax is included in the unit price</label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div><label className="ui-label">Notes</label><textarea aria-label="Quotation notes" value={form.notes} onChange={(event) => setForm((previous) => ({...previous, notes: event.target.value}))} rows={4} placeholder="Optional message to the customer" className="ui-field min-h-28 resize-y" /></div><div><label className="ui-label">Terms & Conditions</label><textarea aria-label="Quotation terms and conditions" value={form.terms} onChange={(event) => setForm((previous) => ({...previous, terms: event.target.value}))} rows={4} placeholder="Payment terms, validity conditions or other terms" className="ui-field min-h-28 resize-y" /></div></div></section>
        </div>

        <aside className="xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiFileText /></span><div><h2 className="font-bold text-slate-950">Quotation summary</h2><p className="text-xs text-slate-500">{displayedNumber}</p></div></div>
            <div className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{money(subtotal)}</span></div><div className="flex justify-between"><span className="text-slate-500">Tax added</span><span className="font-semibold">{money(addedTax)}</span></div>{includedTax > 0 && <div className="flex justify-between text-xs"><span className="text-slate-400">Tax included</span><span className="text-slate-500">{money(includedTax)}</span></div>}<div className="flex items-center justify-between gap-4"><label className="text-slate-500">Quote discount</label><input type="number" aria-label="Quotation discount" min="0" step="0.01" value={form.discount} onChange={(event) => setForm((previous) => ({...previous, discount: Number(event.target.value)}))} className="w-32 rounded-lg border border-slate-200 px-2.5 py-2 text-right text-sm focus:border-primary-400 focus:outline-none" /></div></div>
            <div className="py-5"><div className="flex items-end justify-between gap-3"><span className="text-base font-bold text-slate-900">Total</span><span className="text-2xl font-bold tracking-[-0.02em] text-primary-700">{money(total)}</span></div></div>
            {canSend && <button type="button" onClick={() => save(true)} className="ui-primary-button w-full"><FiSend /> Save & Mark Sent</button>}
            <button type="button" onClick={() => save(false)} className="ui-secondary-button mt-2 w-full"><FiSave /> {existingQuotation ? 'Save Changes' : 'Save Draft'}</button>
            <button type="button" onClick={() => navigate(existingQuotation ? `/quotations/${existingQuotation.id}` : '/quotations')} className="mt-3 w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
