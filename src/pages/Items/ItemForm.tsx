import {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {FiArrowLeft, FiBox, FiDollarSign, FiHash, FiPackage, FiSave, FiTool} from 'react-icons/fi';
import {toast} from 'react-hot-toast';
import {useStore} from '../../store/useStore';
import {cn} from '../../utils/helpers';
import type {Item} from '../../types';
import PageHeader from '../../components/PageHeader';

interface FormData {
  type: 'product' | 'service';
  name: string;
  description: string;
  sku: string;
  unit: string;
  price: number;
  currency: string;
  tax: number;
  taxInclusive: boolean;
  costPrice: number;
  stockQuantity: number;
  barcode: string;
}

const defaultForm: FormData = {type: 'product', name: '', description: '', sku: '', unit: 'Each', price: 0, currency: 'ZMW', tax: 0, taxInclusive: false, costPrice: 0, stockQuantity: 0, barcode: ''};
const units = ['Each', 'Hour', 'Day', 'Month', 'Kg', 'Box', 'Meter', 'Litre'];

export default function ItemForm() {
  const navigate = useNavigate();
  const {id} = useParams();
  const {items, addItem, updateItem, business} = useStore();
  const [form, setForm] = useState<FormData>(defaultForm);

  useEffect(() => {
    if (!id && business?.currency) setForm((previous) => ({...previous, currency: business.currency}));
    if (!id) return;
    const item = items.find((candidate) => candidate.id === id);
    if (item) setForm({type: item.type, name: item.name, description: item.description, sku: item.sku, unit: item.unit, price: item.price, currency: item.currency, tax: item.tax, taxInclusive: item.taxInclusive, costPrice: item.costPrice, stockQuantity: item.stockQuantity, barcode: item.barcode});
  }, [business?.currency, id, items]);

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => setForm((previous) => ({...previous, [field]: value}));

  const handleSave = () => {
    if (!form.name.trim()) {toast.error('Item name is required.'); return;}
    if (!Number.isFinite(form.price) || form.price < 0) {toast.error('Price must be zero or greater.'); return;}
    const existingItem = id ? items.find((candidate) => candidate.id === id) : undefined;
    const data: Item = {...form, currency: business?.currency || form.currency, id: id || Date.now().toString(36), createdAt: existingItem?.createdAt ?? Date.now()};
    const result = id ? updateItem(data) : addItem(data);
    if (!result.success) {toast.error(result.error ?? 'Item could not be saved.'); return;}
    toast.success(id ? 'Item updated' : 'Item added');
    navigate('/items');
  };

  return (
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={() => navigate('/items')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><FiArrowLeft /> Back to products & services</button>
      <PageHeader title={id ? 'Edit Item' : 'Add Product or Service'} description="Define reusable pricing and tax defaults for invoices and quotations." />

      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5"><h2 className="ui-section-title">Item type</h2><p className="mt-1 text-sm text-slate-500">Products can track stock. Services focus on time or service units.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">{(['product', 'service'] as const).map((type) => {const Icon = type === 'product' ? FiPackage : FiTool; const selected = form.type === type; return <button key={type} type="button" aria-pressed={selected} onClick={() => handleChange('type', type)} className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition-all', selected ? 'border-primary-300 bg-primary-50 text-primary-800 ring-2 ring-primary-100' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}><span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', selected ? 'bg-primary-100 text-primary-700' : 'bg-slate-100')}><Icon /></span><span><span className="block text-sm font-semibold capitalize">{type}</span><span className="block text-xs opacity-70">{type === 'product' ? 'Physical or stocked item' : 'Professional service'}</span></span></button>;})}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5"><h2 className="ui-section-title">Basic information</h2><p className="mt-1 text-sm text-slate-500">How this item appears in your product catalogue.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><label className="ui-label">Name <span className="text-rose-500">*</span></label><div className="relative"><FiBox className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" aria-label="Item name" value={form.name} onChange={(event) => handleChange('name', event.target.value)} placeholder={form.type === 'product' ? 'e.g. Printer Cartridge' : 'e.g. Website Design'} className="ui-field ui-field-with-icon" /></div></div>
            <div className="md:col-span-2"><label className="ui-label">Description</label><textarea rows={3} aria-label="Item description" value={form.description} onChange={(event) => handleChange('description', event.target.value)} placeholder="Optional description shown when the item is added to a document" className="ui-field min-h-24 resize-y" /></div>
            <div><label className="ui-label">SKU</label><div className="relative"><FiHash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" aria-label="SKU" value={form.sku} onChange={(event) => handleChange('sku', event.target.value)} placeholder="Optional internal code" className="ui-field ui-field-with-icon" /></div></div>
            <div><label className="ui-label">Unit</label><select aria-label="Unit" value={form.unit} onChange={(event) => handleChange('unit', event.target.value)} className="ui-field">{units.map((unit) => <option key={unit}>{unit}</option>)}</select></div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5"><h2 className="ui-section-title">Pricing & tax</h2><p className="mt-1 text-sm text-slate-500">Default values can still be adjusted when adding the item to a document.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><label className="ui-label">Selling price <span className="text-rose-500">*</span></label><div className="relative"><FiDollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="number" aria-label="Selling price" min="0" step="0.01" value={form.price} onChange={(event) => handleChange('price', Number(event.target.value))} className="ui-field ui-field-with-icon" /></div></div>
            <div><label className="ui-label">Currency</label><div className="ui-field flex items-center bg-slate-50 text-slate-600">{business?.currency || form.currency}</div><p className="mt-1.5 text-xs text-slate-400">Locked to your business currency.</p></div>
            <div><label className="ui-label">Tax rate (%)</label><input type="number" aria-label="Tax rate" min="0" max="100" step="0.01" value={form.tax} onChange={(event) => handleChange('tax', Number(event.target.value))} className="ui-field" /></div>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700"><input type="checkbox" aria-label="Tax inclusive" checked={form.taxInclusive} onChange={(event) => handleChange('taxInclusive', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600" /><span><span className="block font-semibold">Tax inclusive</span><span className="text-xs font-normal text-slate-400">Price already includes the tax amount.</span></span></label>
          </div>
        </section>

        {form.type === 'product' && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6"><div className="mb-5"><h2 className="ui-section-title">Inventory information</h2><p className="mt-1 text-sm text-slate-500">Optional product tracking information for your records.</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><div><label className="ui-label">Cost price</label><input type="number" aria-label="Cost price" min="0" step="0.01" value={form.costPrice} onChange={(event) => handleChange('costPrice', Number(event.target.value))} className="ui-field" /></div><div><label className="ui-label">Stock quantity</label><input type="number" aria-label="Stock quantity" min="0" step="1" value={form.stockQuantity} onChange={(event) => handleChange('stockQuantity', Number(event.target.value))} className="ui-field" /></div><div><label className="ui-label">Barcode</label><input type="text" aria-label="Barcode" value={form.barcode} onChange={(event) => handleChange('barcode', event.target.value)} placeholder="Optional barcode" className="ui-field" /></div></div></section>}

        <div className="flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:flex-row sm:justify-end"><button type="button" onClick={() => navigate('/items')} className="ui-secondary-button">Cancel</button><button type="button" onClick={handleSave} className="ui-primary-button"><FiSave /> {id ? 'Save Changes' : 'Save Item'}</button></div>
      </div>
    </div>
  );
}
