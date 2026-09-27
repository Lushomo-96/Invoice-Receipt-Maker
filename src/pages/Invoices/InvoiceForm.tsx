import {useEffect, useMemo, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {FiCalendar, FiCreditCard, FiEdit3, FiEye, FiFileText, FiInfo, FiPlus, FiSave, FiSend, FiTag, FiTrash2, FiUser, FiX} from 'react-icons/fi';
import {toast} from 'react-hot-toast';
import {useStore} from '../../store/useStore';
import {
  calculateTotals,
  formatCurrency,
  generateDocumentNumber,
  generateId,
  getInvoiceEditLockReason,
  recalculateInvoiceItem,
  resolveInvoiceStatus,
  roundMoney,
} from '../../utils/helpers';
import type {Invoice, InvoiceItem} from '../../types';

interface FormData {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerTpin: string;
  items: InvoiceItem[];
  discount: number;
  shipping: number;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
  terms: string;
}

const emptyItem = (tax = 0, taxInclusive = false): InvoiceItem => ({
  itemId: '',
  name: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  tax,
  taxInclusive,
  amount: 0,
});

const paymentTermDays: Record<string, number> = {
  due_on_receipt: 0,
  '7_days': 7,
  '14_days': 14,
  '30_days': 30,
};

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, endOfDay = false): number {
  const [year, month, day] = value.split('-').map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
    : new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function addDaysToDateInput(value: string, days: number): string {
  const date = new Date(parseDateInput(value));
  date.setDate(date.getDate() + days);
  return toDateInput(date.getTime());
}

function normalizePaymentTerms(value: string): string {
  const normalized: Record<string, string> = {
    'Due on Receipt': 'due_on_receipt',
    '7 Days': '7_days',
    '14 Days': '14_days',
    '30 Days': '30_days',
  };
  return normalized[value] ?? (value in paymentTermDays || value === 'custom' ? value : 'custom');
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const {id} = useParams();
  const {customers, invoices, payments, receipts, paymentMethods, items: masterItems, addInvoice, updateInvoice, settings, business} = useStore();
  const currency = business?.currency || 'ZMW';
  const money = (amount: number) => formatCurrency(amount, currency);

  const today = toDateInput(Date.now());
  const [selectedPaymentMethodIds, setSelectedPaymentMethodIds] = useState<string[]>(() => paymentMethods.map((method) => method.id));
  const [form, setForm] = useState<FormData>({
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerTpin: '',
    items: [emptyItem(settings.financial.defaultTaxRate, settings.financial.defaultTaxInclusive)],
    discount: 0,
    shipping: 0,
    issueDate: today,
    dueDate: addDaysToDateInput(today, paymentTermDays[settings.document.defaultInvoicePaymentTerms]),
    paymentTerms: settings.document.defaultInvoicePaymentTerms,
    notes: '',
    terms: '',
  });

  const existingInvoice = useMemo(
    () => (id ? invoices.find((invoice) => invoice.id === id) : undefined),
    [id, invoices],
  );
  const editLockReason = existingInvoice
    ? getInvoiceEditLockReason(
        existingInvoice,
        payments.some((payment) => payment.invoiceId === existingInvoice.id),
        receipts.some((receipt) => receipt.linkedInvoiceId === existingInvoice.id),
      )
    : null;
  const displayedInvoiceNumber = existingInvoice?.number ?? generateDocumentNumber(settings.document.invoicePrefix, invoices.map((invoice) => invoice.number));
  const {subtotal, totalDiscount, totalTax, addedTax, includedTax, itemsTotal} = useMemo(() => calculateTotals(form.items), [form.items]);
  const grandTotal = roundMoney(Math.max(itemsTotal - form.discount + form.shipping, 0));

  useEffect(() => {
    if (!existingInvoice) return;
    setSelectedPaymentMethodIds([...existingInvoice.paymentMethods]);
    setForm({
      customerId: existingInvoice.customerId,
      customerName: existingInvoice.customerName,
      customerPhone: existingInvoice.customerPhone,
      customerAddress: existingInvoice.customerAddress,
      customerTpin: existingInvoice.customerTpin,
      items: existingInvoice.items.map((item) => recalculateInvoiceItem({...item, taxInclusive: item.taxInclusive ?? false})),
      discount: existingInvoice.discount,
      shipping: existingInvoice.shipping,
      issueDate: toDateInput(existingInvoice.issueDate),
      dueDate: toDateInput(existingInvoice.dueDate),
      paymentTerms: normalizePaymentTerms(existingInvoice.paymentTerms),
      notes: existingInvoice.notes,
      terms: existingInvoice.terms,
    });
  }, [existingInvoice]);

  const updateItem = <K extends keyof InvoiceItem>(index: number, field: K, value: InvoiceItem[K]) => {
    setForm((previous) => {
      const items = previous.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return recalculateInvoiceItem({...item, [field]: value});
      });
      return {...previous, items};
    });
  };

  const chooseMasterItem = (index: number, itemId: string) => {
    const master = masterItems.find((candidate) => candidate.id === itemId);
    if (!master) {updateItem(index, 'itemId', ''); return;}
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) => itemIndex === index
        ? recalculateInvoiceItem({...item, itemId: master.id, name: master.name, description: master.description, unitPrice: master.price, tax: master.tax, taxInclusive: master.taxInclusive})
        : item),
    }));
  };

  const addItemRow = () => setForm((previous) => ({...previous, items: [...previous.items, emptyItem(settings.financial.defaultTaxRate, settings.financial.defaultTaxInclusive)]}));

  const removeItemRow = (index: number) => {
    if (form.items.length <= 1) return;
    setForm((previous) => ({...previous, items: previous.items.filter((_, itemIndex) => itemIndex !== index)}));
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((candidate) => candidate.id === customerId);
    if (!customer) {
      setForm((previous) => ({
        ...previous,
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        customerTpin: '',
      }));
      return;
    }
    setForm((previous) => ({
      ...previous,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerTpin: customer.tpin,
    }));
  };

  useEffect(() => {
    if (id || existingInvoice) return;
    const preselectedCustomerId = (location.state as {customerId?: string} | null)?.customerId;
    if (preselectedCustomerId) handleCustomerSelect(preselectedCustomerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, id]);

  const handleIssueDateChange = (issueDate: string) => {
    setForm((previous) => {
      const days = paymentTermDays[previous.paymentTerms];
      return {
        ...previous,
        issueDate,
        dueDate: days == null ? previous.dueDate : addDaysToDateInput(issueDate, days),
      };
    });
  };

  const handleDueDateChange = (dueDate: string) => {
    setForm((previous) => ({...previous, dueDate, paymentTerms: 'custom'}));
  };

  const handlePaymentTermsChange = (paymentTerms: string) => {
    setForm((previous) => ({
      ...previous,
      paymentTerms,
      dueDate: paymentTermDays[paymentTerms] == null
        ? previous.dueDate
        : addDaysToDateInput(previous.issueDate, paymentTermDays[paymentTerms]),
    }));
  };

  const validate = (allowIncompleteDraft: boolean): string | null => {
    if (!allowIncompleteDraft && (!form.customerId || !form.customerName.trim())) return 'Select a customer before saving the invoice.';
    if (!form.issueDate || !form.dueDate) return 'Issue date and due date are required.';

    const issueDate = parseDateInput(form.issueDate);
    const dueDate = parseDateInput(form.dueDate, true);
    if (!Number.isFinite(issueDate) || !Number.isFinite(dueDate)) return 'Enter valid invoice dates.';
    if (dueDate < issueDate) return 'Due date cannot be earlier than the issue date.';

    for (let index = 0; index < form.items.length; index += 1) {
      const item = form.items[index];
      const label = `Item ${index + 1}`;
      const hasEnteredData = Boolean(item.name.trim()) || item.unitPrice !== 0 || item.discount !== 0 || item.tax !== 0 || item.quantity !== 1;
      if (allowIncompleteDraft && !hasEnteredData) continue;
      if (!item.name.trim()) return `${label} needs a name.`;
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) return `${label} quantity must be greater than 0.`;
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) return `${label} unit price cannot be negative.`;
      if (!Number.isFinite(item.discount) || item.discount < 0) return `${label} discount cannot be negative.`;
      const lineSubtotal = item.quantity * item.unitPrice;
      if (item.discount > lineSubtotal) return `${label} discount cannot exceed its line subtotal.`;
      if (!Number.isFinite(item.tax) || item.tax < 0 || item.tax > 100) return `${label} tax must be between 0% and 100%.`;
    }

    if (!Number.isFinite(form.discount) || form.discount < 0) return 'Invoice discount cannot be negative.';
    if (form.discount > itemsTotal) return 'Invoice discount cannot exceed the items total.';
    if (!Number.isFinite(form.shipping) || form.shipping < 0) return 'Shipping cannot be negative.';
    if (!allowIncompleteDraft && grandTotal <= 0) return 'Invoice total must be greater than 0.';
    if (existingInvoice && grandTotal < existingInvoice.amountPaid) {
      return `Invoice total cannot be lower than the amount already paid (${money(existingInvoice.amountPaid)}).`;
    }
    return null;
  };

  const handleSave = (draft: boolean) => {
    const savingIncompleteDraft = draft && (!existingInvoice || existingInvoice.status === 'draft');
    const validationError = validate(savingIncompleteDraft);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const now = Date.now();
    const issueDate = parseDateInput(form.issueDate);
    const dueDate = parseDateInput(form.dueDate, true);
    const amountPaid = existingInvoice?.amountPaid ?? 0;
    const balanceDue = roundMoney(Math.max(grandTotal - amountPaid, 0));
    const saveAsDraft = draft && (!existingInvoice || existingInvoice.status === 'draft');
    const baseStatus: Invoice['status'] = existingInvoice?.status === 'cancelled'
      ? 'cancelled'
      : saveAsDraft
        ? 'draft'
        : 'unpaid';
    const status = resolveInvoiceStatus({
      status: baseStatus,
      grandTotal,
      amountPaid,
      dueDate,
    }, now);

    const data: Invoice = {
      id: existingInvoice?.id ?? generateId(),
      number: displayedInvoiceNumber,
      customerId: form.customerId,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerAddress: form.customerAddress,
      customerTpin: form.customerTpin,
      items: form.items.map(recalculateInvoiceItem),
      subtotal,
      discount: roundMoney(form.discount),
      tax: totalTax,
      shipping: roundMoney(form.shipping),
      grandTotal,
      amountPaid,
      balanceDue,
      issueDate,
      dueDate,
      referenceNumber: existingInvoice?.referenceNumber ?? '',
      purchaseOrderNumber: existingInvoice?.purchaseOrderNumber ?? '',
      paymentTerms: form.paymentTerms,
      paymentMethods: [...selectedPaymentMethodIds],
      notes: form.notes,
      terms: form.terms,
      attachment: existingInvoice?.attachment ?? '',
      status,
      createdAt: existingInvoice?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingInvoice) {
      const result = updateInvoice(data);
      if (!result.success) {
        toast.error(result.error ?? 'Unable to update invoice.');
        return;
      }
    } else {
      const result = addInvoice(data);
      if (!result.success) {
        toast.error(result.error ?? 'Unable to create invoice.');
        return;
      }
    }
    toast.success(existingInvoice ? 'Invoice updated' : draft ? 'Draft saved' : 'Invoice created');
    navigate('/invoices');
  };

  if (id && !existingInvoice) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Invoice not found</h2>
        <p className="mt-2 text-sm text-slate-500">The invoice may have been deleted or the link is invalid.</p>
        <button onClick={() => navigate('/invoices')} className="ui-primary-button mt-4">Back to Invoices</button>
      </div>
    );
  }

  if (existingInvoice && editLockReason) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Invoice editing is locked</h2>
        <p className="mt-2 text-sm text-slate-600">{editLockReason}</p>
        <button onClick={() => navigate(`/invoices/${existingInvoice.id}`)} className="ui-primary-button mt-4">Back to Invoice</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl">{existingInvoice ? 'Edit Invoice' : 'Create Invoice'}</h1>
          <p className="mt-1 text-sm text-slate-500">{existingInvoice ? 'Update the invoice details without changing its payment history.' : 'Fill in the details below to create a professional invoice.'}</p>
        </div>
        <button type="button" onClick={() => navigate('/invoices')} className="ui-secondary-button w-full sm:w-auto"><FiX className="h-4 w-4" /> Close</button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5 lg:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiUser className="h-4.5 w-4.5" /></span>
                <div><h2 className="ui-section-title">Customer Information</h2><p className="mt-0.5 text-xs text-slate-500">Who is this invoice for?</p></div>
              </div>
              <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 sm:inline">{currency}</span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <label className="ui-label">Customer <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <FiUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select aria-label="Customer" value={form.customerId} onChange={(event) => handleCustomerSelect(event.target.value)} className="ui-field ui-field-with-icon">
                      <option value="">Search or select customer</option>
                      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => navigate('/customers/new', {state: {from: 'invoices'}})} className="ui-secondary-button shrink-0 px-3">+ New</button>
                </div>
                {form.customerName && (
                  <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/45 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-anywhere text-sm font-semibold text-slate-900">{form.customerName}</p>
                        <p className="mt-1 break-anywhere text-xs leading-5 text-slate-500">{[form.customerPhone, form.customerAddress].filter(Boolean).join(' · ') || 'Customer details available on record'}</p>
                        {form.customerTpin && <p className="mt-1 text-xs text-slate-400">TPIN: {form.customerTpin}</p>}
                      </div>
                      <FiEdit3 className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="ui-label">Invoice Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <FiFileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <div className="ui-field ui-field-with-icon flex items-center font-semibold text-slate-700 break-anywhere">{displayedInvoiceNumber}</div>
                  </div>
                </div>
                <div>
                  <label className="ui-label">Issue Date <span className="text-red-500">*</span></label>
                  <div className="relative"><FiCalendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="date" aria-label="Issue date" value={form.issueDate} onChange={(event) => handleIssueDateChange(event.target.value)} className="ui-field ui-field-with-icon" /></div>
                </div>
                <div>
                  <label className="ui-label">Due Date <span className="text-red-500">*</span></label>
                  <div className="relative"><FiCalendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="date" aria-label="Due date" value={form.dueDate} min={form.issueDate} onChange={(event) => handleDueDateChange(event.target.value)} className="ui-field ui-field-with-icon" /></div>
                </div>
                <div className="sm:col-span-2">
                  <label className="ui-label">Payment Terms</label>
                  <select aria-label="Payment terms" value={form.paymentTerms} onChange={(event) => handlePaymentTermsChange(event.target.value)} className="ui-field">
                    <option value="due_on_receipt">Due on Receipt</option>
                    <option value="7_days">7 Days</option>
                    <option value="14_days">14 Days</option>
                    <option value="30_days">30 Days</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:px-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiFileText className="h-4.5 w-4.5" /></span>
                <div><h2 className="ui-section-title">Invoice Items</h2><p className="mt-0.5 text-xs text-slate-500">Add the products or services you are billing for.</p></div>
              </div>
              <button type="button" onClick={addItemRow} className="ui-primary-button px-3.5"><FiPlus className="h-4 w-4" /> Add Item</button>
            </div>

            <div className="hidden grid-cols-12 gap-2 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 md:grid sm:px-5 lg:px-6">
              <div className="col-span-4">Item / Description</div><div className="col-span-1">Qty</div><div className="col-span-2">Rate ({currency})</div><div className="col-span-2">Tax / Disc.</div><div className="col-span-2 text-right">Amount</div><div className="col-span-1"></div>
            </div>

            <div className="divide-y divide-slate-100">
              {form.items.map((item, index) => (
                <div key={index} className="grid grid-cols-2 gap-3 p-4 md:grid-cols-12 md:items-start md:gap-2 sm:p-5 lg:px-6">
                  <div className="col-span-2 md:col-span-4">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Item / Description</span>
                    <select aria-label={`Saved item ${index + 1}`} value={item.itemId} onChange={(event) => chooseMasterItem(index, event.target.value)} className="ui-field mb-2 min-h-10 py-2 text-xs"><option value="">Custom item</option>{masterItems.map((master) => <option key={master.id} value={master.id}>{master.name} — {money(master.price)}</option>)}</select>
                    <input type="text" aria-label={`Item name ${index + 1}`} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Item name" className="ui-field min-h-10 py-2" />
                    <input type="text" aria-label={`Item description ${index + 1}`} value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} placeholder="Description (optional)" className="mt-2 w-full rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-xs text-slate-600 placeholder-slate-400 focus:border-primary-200 focus:bg-white focus:outline-none" />
                  </div>
                  <div className="col-span-1 md:col-span-1"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Qty</span><input type="number" aria-label={`Quantity for ${item.name || `item ${index + 1}`}`} min="0.01" step="any" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))} className="ui-field min-h-10 py-2" /></div>
                  <div className="col-span-1 md:col-span-2"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Rate</span><input type="number" aria-label={`Rate for ${item.name || `item ${index + 1}`}`} min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', Number(event.target.value))} className="ui-field min-h-10 py-2" /></div>
                  <div className="col-span-1 md:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Tax / Discount</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="number" min="0" max="100" step="0.01" value={item.tax} onChange={(event) => updateItem(index, 'tax', Number(event.target.value))} className="ui-field min-h-10 px-2 py-2 text-center" aria-label={`Tax percentage for ${item.name || `item ${index + 1}`}`} title="Tax %" />
                      <input type="number" min="0" step="0.01" value={item.discount} onChange={(event) => updateItem(index, 'discount', Number(event.target.value))} className="ui-field min-h-10 px-2 py-2 text-center" aria-label={`Discount for ${item.name || `item ${index + 1}`}`} title="Discount" />
                    </div>
                    <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" aria-label={`Tax inclusive for ${item.name || `item ${index + 1}`}`} checked={item.taxInclusive ?? false} onChange={(event) => updateItem(index, 'taxInclusive', event.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600" /> Tax inclusive</label>
                  </div>
                  <div className="col-span-1 md:col-span-2 md:pt-2"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Amount</span><p className="text-right text-sm font-bold text-slate-900 break-anywhere">{money(item.amount)}</p></div>
                  <div className="col-span-2 flex justify-end md:col-span-1 md:pt-1"><button type="button" onClick={() => removeItemRow(index)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${item.name || `item ${index + 1}`}`}><FiTrash2 className="h-4 w-4" /></button></div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5 lg:px-6">Line discount is a fixed {currency} amount. Tax is a percentage; mark Tax inclusive when the unit price already contains tax.</div>
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
              <div className="mb-4 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiTag className="h-4.5 w-4.5" /></span><div><h2 className="ui-section-title">Additional Charges</h2><p className="mt-0.5 text-xs text-slate-500">Adjust the invoice-level totals.</p></div></div>
              <div className="space-y-4">
                <div><label htmlFor="invoice-discount" className="ui-label">Invoice Discount ({currency})</label><input id="invoice-discount" type="number" min="0" step="0.01" value={form.discount} onChange={(event) => setForm((previous) => ({...previous, discount: Number(event.target.value)}))} className="ui-field" /></div>
                <div><label htmlFor="shipping" className="ui-label">Shipping ({currency})</label><input id="shipping" type="number" min="0" step="0.01" value={form.shipping} onChange={(event) => setForm((previous) => ({...previous, shipping: Number(event.target.value)}))} className="ui-field" /></div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiCreditCard className="h-4.5 w-4.5" /></span><div><h2 className="ui-section-title">Payment Methods</h2><p className="mt-0.5 text-xs text-slate-500">Instructions saved with this invoice.</p></div></div>
                {paymentMethods.length > 0 && <button type="button" onClick={() => setSelectedPaymentMethodIds(selectedPaymentMethodIds.length === paymentMethods.length ? [] : paymentMethods.map((method) => method.id))} className="text-xs font-semibold text-primary-600 hover:text-primary-700">{selectedPaymentMethodIds.length === paymentMethods.length ? 'Clear' : 'All'}</button>}
              </div>
              {paymentMethods.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">No payment methods configured. Add bank, mobile money, cash or other instructions in Settings → Payment Methods.</div>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((method) => {
                    const checked = selectedPaymentMethodIds.includes(method.id);
                    const label = method.accountName || method.provider || method.bankName || method.type.replace(/_/g, ' ');
                    const detail = method.type === 'bank_transfer' ? [method.bankName, method.accountNumber].filter(Boolean).join(' · ') : method.phoneNumber || method.accountNumber || '';
                    return (
                      <label key={method.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-primary-200 bg-primary-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={checked} onChange={(event) => setSelectedPaymentMethodIds((current) => event.target.checked ? [...current, method.id] : current.filter((methodId) => methodId !== method.id))} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                        <span className="min-w-0"><span className="block break-anywhere text-sm font-semibold capitalize text-slate-800">{label}</span>{detail && <span className="mt-0.5 block break-anywhere text-xs text-slate-500">{detail}</span>}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className="ui-label">Notes</label><textarea aria-label="Invoice notes" value={form.notes} onChange={(event) => setForm((previous) => ({...previous, notes: event.target.value}))} rows={4} className="ui-field min-h-28 resize-y" placeholder="Thank you for your business." /></div>
              <div><label className="ui-label">Terms & Conditions</label><textarea aria-label="Invoice terms and conditions" value={form.terms} onChange={(event) => setForm((previous) => ({...previous, terms: event.target.value}))} rows={4} className="ui-field min-h-28 resize-y" placeholder="Payment is due within the agreed terms." /></div>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="mb-5 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><FiFileText className="h-4.5 w-4.5" /></span><div><h2 className="text-base font-bold text-slate-950">Invoice Summary</h2><p className="text-xs text-slate-500">Live totals</p></div></div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-500">Subtotal</span><span className="font-semibold text-slate-900">{money(subtotal)}</span></div>
              {totalDiscount > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Line discounts</span><span className="font-semibold text-emerald-600">− {money(totalDiscount)}</span></div>}
              {form.discount > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Invoice discount</span><span className="font-semibold text-emerald-600">− {money(form.discount)}</span></div>}
              {addedTax > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Tax added</span><span className="font-semibold text-slate-900">{money(addedTax)}</span></div>}
              {includedTax > 0 && <div className="flex justify-between gap-4"><span className="text-slate-500">Tax included</span><span className="font-semibold text-slate-900">{money(includedTax)}</span></div>}
              <div className="flex justify-between gap-4"><span className="text-slate-500">Shipping</span><span className="font-semibold text-slate-900">{money(form.shipping)}</span></div>
            </div>
            <div className="my-5 border-t border-slate-200" />
            <div className="flex items-end justify-between gap-4"><span className="text-base font-bold text-slate-950">Total</span><span className="break-anywhere text-right text-2xl font-extrabold tracking-[-0.025em] text-primary-700">{money(grandTotal)}</span></div>
            {existingInvoice && existingInvoice.amountPaid > 0 && <div className="mt-3 flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><span>Already paid</span><span>{money(existingInvoice.amountPaid)}</span></div>}

            <div className="mt-5 rounded-xl bg-primary-50/70 p-3.5 text-xs leading-5 text-primary-800"><div className="flex items-start gap-2"><FiInfo className="mt-0.5 h-4 w-4 shrink-0" /><p>This invoice will use <strong>{currency}</strong>, your current business currency.</p></div></div>

            <div className="mt-5 space-y-2.5">
              <button type="button" onClick={() => handleSave(false)} className="ui-primary-button w-full"><FiSend className="h-4 w-4" /> {existingInvoice ? 'Save Invoice' : 'Create Invoice'}</button>
              <button type="button" onClick={() => existingInvoice ? navigate(`/invoices/preview/${existingInvoice.id}`) : toast('Save the invoice first to preview it.')} className="ui-secondary-button w-full text-primary-700"><FiEye className="h-4 w-4" /> Preview Invoice</button>
              <button type="button" onClick={() => handleSave(true)} className="ui-secondary-button w-full"><FiSave className="h-4 w-4" /> {existingInvoice?.status === 'draft' ? 'Save Draft' : existingInvoice ? 'Save Changes' : 'Save Draft'}</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
