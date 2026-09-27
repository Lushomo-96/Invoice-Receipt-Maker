import type {ReactNode} from 'react';
import {useEffect, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {FiArrowLeft, FiBriefcase, FiFileText, FiGlobe, FiMail, FiMapPin, FiPhone, FiSave, FiUser} from 'react-icons/fi';
import {toast} from 'react-hot-toast';
import {useStore} from '../../store/useStore';
import {cn} from '../../utils/helpers';
import type {Customer} from '../../types';
import PageHeader from '../../components/PageHeader';

interface FormData {
  type: 'individual' | 'business';
  name: string;
  businessName: string;
  phone: string;
  email: string;
  tpin: string;
  address: string;
  townCity: string;
  country: string;
  notes: string;
}

const defaultForm: FormData = {type: 'individual', name: '', businessName: '', phone: '', email: '', tpin: '', address: '', townCity: '', country: 'Zambia', notes: ''};

export default function CustomerForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const {id} = useParams();
  const returnTo = (location.state as {from?: 'invoices' | 'quotations'} | null)?.from;
  const {customers, addCustomer, updateCustomer, setCurrentPage} = useStore();
  const [form, setForm] = useState<FormData>(defaultForm);

  useEffect(() => {
    if (!id) return;
    const customer = customers.find((candidate) => candidate.id === id);
    if (customer) setForm({type: customer.type, name: customer.name, businessName: customer.businessName, phone: customer.phone, email: customer.email, tpin: customer.tpin, address: customer.address, townCity: customer.townCity, country: customer.country, notes: customer.notes});
  }, [customers, id]);

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => setForm((previous) => ({...previous, [field]: value}));

  const validate = (): string | null => {
    if (!form.name.trim()) return form.type === 'business' ? 'Contact name is required.' : 'Customer name is required.';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Enter a valid email address.';
    return null;
  };

  const persist = (): Customer | null => {
    const error = validate();
    if (error) {
      toast.error(error);
      return null;
    }
    const existingCustomer = id ? customers.find((candidate) => candidate.id === id) : undefined;
    const data: Customer = {
      ...form,
      id: id || Date.now().toString(36),
      outstandingBalance: existingCustomer?.outstandingBalance ?? 0,
      createdAt: existingCustomer?.createdAt ?? Date.now(),
    };
    const result = id ? updateCustomer(data) : addCustomer(data);
    if (!result.success) {
      toast.error(result.error ?? 'Unable to save the customer.');
      return null;
    }
    return data;
  };

  const handleSave = () => {
    const saved = persist();
    if (!saved) return;
    toast.success(id ? 'Customer updated' : 'Customer added');
    navigate(`/customers/${saved.id}`);
  };

  const handleSaveAndInvoice = () => {
    const saved = persist();
    if (!saved) return;
    toast.success(id ? 'Customer updated' : 'Customer added');
    setCurrentPage('invoices');
    navigate('/invoices/new', {state: {customerId: saved.id}});
  };

  const handleSaveAndQuotation = () => {
    const saved = persist();
    if (!saved) return;
    toast.success(id ? 'Customer updated' : 'Customer added');
    setCurrentPage('quotations');
    navigate('/quotations/new', {state: {customerId: saved.id}});
  };

  const iconField = (icon: ReactNode, input: ReactNode) => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
      {input}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={() => navigate(id ? `/customers/${id}` : '/customers')} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"><FiArrowLeft /> Back to customers</button>
      <PageHeader
        title={id ? 'Edit Customer' : 'Add Customer'}
        description={id ? 'Update contact and billing information without changing historical documents.' : 'Save customer details once and reuse them on invoices, quotations and receipts.'}
      />

      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5">
            <h2 className="ui-section-title">Customer type</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the profile that best matches this customer.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            {(['individual', 'business'] as const).map((type) => {
              const Icon = type === 'individual' ? FiUser : FiBriefcase;
              const selected = form.type === type;
              return (
                <button key={type} type="button" aria-pressed={selected} onClick={() => handleChange('type', type)} className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition-all', selected ? 'border-primary-300 bg-primary-50 text-primary-800 ring-2 ring-primary-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', selected ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500')}><Icon /></span>
                  <span><span className="block text-sm font-semibold capitalize">{type}</span><span className="block text-xs opacity-70">{type === 'individual' ? 'Personal customer' : 'Company or organization'}</span></span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5"><h2 className="ui-section-title">Identity & contact</h2><p className="mt-1 text-sm text-slate-500">Information shown on customer records and new documents.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="ui-label">{form.type === 'business' ? 'Contact Name' : 'Customer Name'} <span className="text-rose-500">*</span></label>
              {iconField(<FiUser className="h-4 w-4" />, <input type="text" aria-label={form.type === 'business' ? 'Contact name' : 'Customer name'} value={form.name} onChange={(event) => handleChange('name', event.target.value)} placeholder={form.type === 'business' ? 'e.g. Mary Banda' : 'e.g. Mary Banda'} className="ui-field ui-field-with-icon" />)}
            </div>
            <div>
              <label className="ui-label">Business Name</label>
              {iconField(<FiBriefcase className="h-4 w-4" />, <input type="text" aria-label="Business name" value={form.businessName} onChange={(event) => handleChange('businessName', event.target.value)} placeholder="e.g. Zambezi Traders Ltd" className="ui-field ui-field-with-icon" />)}
            </div>
            <div>
              <label className="ui-label">Phone</label>
              {iconField(<FiPhone className="h-4 w-4" />, <input type="tel" aria-label="Phone" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} placeholder="+260..." className="ui-field ui-field-with-icon" />)}
            </div>
            <div>
              <label className="ui-label">Email</label>
              {iconField(<FiMail className="h-4 w-4" />, <input type="email" aria-label="Email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="customer@example.com" className="ui-field ui-field-with-icon" />)}
            </div>
            <div className="md:col-span-2">
              <label className="ui-label">TPIN</label>
              {iconField(<FiFileText className="h-4 w-4" />, <input type="text" aria-label="TPIN" value={form.tpin} onChange={(event) => handleChange('tpin', event.target.value)} placeholder="Taxpayer identification number" className="ui-field ui-field-with-icon" />)}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <div className="mb-5"><h2 className="ui-section-title">Address</h2><p className="mt-1 text-sm text-slate-500">Used as the customer billing address on new documents.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="ui-label">Street address</label>
              {iconField(<FiMapPin className="h-4 w-4" />, <input type="text" aria-label="Street address" value={form.address} onChange={(event) => handleChange('address', event.target.value)} placeholder="Plot / street / area" className="ui-field ui-field-with-icon" />)}
            </div>
            <div>
              <label className="ui-label">Town / City</label>
              {iconField(<FiMapPin className="h-4 w-4" />, <input type="text" aria-label="Town or city" value={form.townCity} onChange={(event) => handleChange('townCity', event.target.value)} placeholder="Lusaka" className="ui-field ui-field-with-icon" />)}
            </div>
            <div>
              <label className="ui-label">Country</label>
              <div className="relative"><FiGlobe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select aria-label="Country" value={form.country} onChange={(event) => handleChange('country', event.target.value)} className="ui-field ui-field-with-icon appearance-none"><option>Zambia</option><option>Tanzania</option><option>Malawi</option><option>Mozambique</option><option>Zimbabwe</option><option>Other</option></select></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6">
          <label className="ui-label">Internal notes</label>
          <textarea aria-label="Internal notes" value={form.notes} onChange={(event) => handleChange('notes', event.target.value)} rows={4} placeholder="Optional notes about this customer. These are for your records." className="ui-field min-h-28 resize-y" />
        </section>

        <div className="flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={() => navigate(id ? `/customers/${id}` : '/customers')} className="ui-secondary-button">Cancel</button>
          {returnTo === 'quotations'
            ? <button type="button" onClick={handleSaveAndQuotation} className="ui-secondary-button"><FiFileText /> Save & Create Quotation</button>
            : <button type="button" onClick={handleSaveAndInvoice} className="ui-secondary-button"><FiFileText /> Save & Create Invoice</button>}
          <button type="button" onClick={handleSave} className="ui-primary-button"><FiSave /> Save Customer</button>
        </div>
      </div>
    </div>
  );
}
