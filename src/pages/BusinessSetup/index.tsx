import {toast} from 'react-hot-toast';
import React, {useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useStore} from '../../store/useStore';
import {cn, generateId} from '../../utils/helpers';
import type {Business} from '../../types';
import Card from '../../components/Card';
import {
  FiArrowLeft,
  FiArrowRight,
  FiBriefcase,
  FiCamera,
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiGlobe,
  FiHash,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi';

export default function BusinessSetup() {
  const navigate = useNavigate();
  const business = useStore((s) => s.business);
  const setBusiness = useStore((s) => s.setBusiness);
  const setIsAuthenticated = useStore((s) => s.setAuthenticated);
  const isEditing = Boolean(business);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    logo: business?.logo || '',
    name: business?.name || '',
    type: business?.type || '',
    tpin: business?.tpin || '',
    registrationNumber: business?.registrationNumber || '',
    phone: business?.phone || '',
    email: business?.email || '',
    website: business?.website || '',
    addressLine1: business?.addressLine1 || '',
    addressLine2: business?.addressLine2 || '',
    townCity: business?.townCity || '',
    country: business?.country || '',
    currency: business?.currency || 'ZMW',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const logoInputRef = useRef<HTMLInputElement>(null);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Business name is required';
    if (!form.currency.trim()) newErrors.currency = 'Default currency is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({...prev, [field]: value}));
    if (errors[field]) {
      setErrors((prev) => {
        const next = {...prev};
        delete next[field];
        return next;
      });
    }
  };

  const handleLogoUpload = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Use a PNG or JPEG logo.');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Logo must be 1 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') handleChange('logo', reader.result);
    };
    reader.onerror = () => toast.error('Unable to read that logo file.');
    reader.readAsDataURL(file);
  };

  const handleContinue = () => {
    if (validate()) setStep(2);
  };

  const handleSave = () => {
    if (!validate()) return;
    const profile: Business = {
      id: business?.id || generateId(),
      ...form,
      slogan: business?.slogan || '',
      taxRegNumber: business?.taxRegNumber || '',
      additionalIdentifier: business?.additionalIdentifier || '',
    };
    const result = setBusiness(profile);
    if (!result.success) {
      toast.error(result.error ?? 'Unable to save the business profile.');
      return;
    }
    setIsAuthenticated(true);
    toast.success(isEditing ? 'Business profile updated!' : 'Business profile saved!');
    navigate('/home');
  };

  const handleCancel = () => {
    if (business) navigate('/settings');
  };

  const inputClass = (field: string) => cn('ui-field', errors[field] && 'border-red-300 focus:border-red-400 focus:ring-red-100');
  const iconInputClass = (field: string) => cn(inputClass(field), 'ui-field-with-icon');
  const labelClass = 'ui-label';

  const FieldIcon = ({children}: {children: React.ReactNode}) => (
    <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-400">{children}</span>
  );

  return (
    <div className="min-h-[100dvh] bg-[#f7f8fc] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate(business ? '/settings' : '/business')} className="flex min-w-0 items-center gap-3 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-[0_8px_22px_rgba(91,52,245,0.24)]">
              <FiFileText className="h-5 w-5 text-white" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-bold text-slate-950">Invoice &</span>
              <span className="block text-sm font-bold text-slate-950">Receipt Maker</span>
            </span>
          </button>
          {isEditing && (
            <button type="button" onClick={handleCancel} className="ui-secondary-button px-3 sm:px-4">
              <FiArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Settings</span>
              <span className="sm:hidden">Back</span>
            </button>
          )}
        </div>

        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-slate-950 sm:text-3xl">{isEditing ? 'Business Profile' : 'Business Setup'}</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">{isEditing ? 'Review and update the details used across invoices and receipts.' : 'Set up your business profile to get started.'}</p>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-7 lg:px-9">
            <div className="mx-auto flex max-w-xl items-center justify-center gap-3 sm:gap-4">
              {[
                {number: 1, label: 'Business Details'},
                {number: 2, label: 'Review & Save'},
              ].map((item, index) => (
                <React.Fragment key={item.number}>
                  <div className="flex items-center gap-2">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors', step >= item.number ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500')}>
                      {step > item.number ? <FiCheck className="h-4 w-4" /> : item.number}
                    </span>
                    <span className={cn('hidden text-sm font-semibold sm:inline', step >= item.number ? 'text-primary-700' : 'text-slate-400')}>{item.label}</span>
                  </div>
                  {index === 0 && <div className={cn('h-px w-10 sm:w-20', step > 1 ? 'bg-primary-400' : 'bg-slate-200')} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="p-4 sm:p-7 lg:p-9">
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-[-0.015em] text-slate-950">Business Details</h2>
                <p className="mt-1 text-sm text-slate-500">Tell us about your business so we can personalize your invoices and receipts.</p>
              </div>

              <div className="mb-7">
                <label className={labelClass}>Business Logo</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50">
                    {form.logo ? <img src={form.logo} alt="Business logo" className="h-full w-full object-cover" /> : <FiCamera className="h-8 w-8 text-slate-400" />}
                  </div>
                  <div className="min-w-0">
                    <input ref={logoInputRef} type="file" aria-label="Upload business logo" accept="image/png,image/jpeg" className="hidden" onChange={(event) => { handleLogoUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => logoInputRef.current?.click()} className="ui-primary-button">
                        <FiUploadCloud className="h-4 w-4" />
                        {form.logo ? 'Replace Logo' : 'Upload Logo'}
                      </button>
                      {form.logo && <button type="button" onClick={() => handleChange('logo', '')} className="ui-secondary-button"><FiX className="h-4 w-4" /> Remove</button>}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">PNG or JPEG, up to 1 MB. Recommended: 200×200 px.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Business Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <FieldIcon><FiBriefcase className="h-4 w-4" /></FieldIcon>
                    <input type="text" aria-label="Business name" aria-invalid={Boolean(errors.name)} value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Enter business name" className={iconInputClass('name')} />
                  </div>
                  {errors.name && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.name}</p>}
                </div>

                <div>
                  <label className={labelClass}>Business Type</label>
                  <div className="relative">
                    <FieldIcon><FiBriefcase className="h-4 w-4" /></FieldIcon>
                    <select aria-label="Business type" value={form.type} onChange={(e) => handleChange('type', e.target.value)} className={iconInputClass('type')}>
                      <option value="">Select type</option>
                      <option value="sole_proprietorship">Sole Proprietorship</option>
                      <option value="partnership">Partnership</option>
                      <option value="private_company">Private Company</option>
                      <option value="public_company">Public Company</option>
                      <option value="non_profit">Non-Profit</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>TPIN</label>
                  <div className="relative">
                    <FieldIcon><FiCreditCard className="h-4 w-4" /></FieldIcon>
                    <input type="text" aria-label="TPIN" value={form.tpin} onChange={(e) => handleChange('tpin', e.target.value)} placeholder="Enter TPIN" className={iconInputClass('tpin')} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Registration Number</label>
                  <div className="relative">
                    <FieldIcon><FiHash className="h-4 w-4" /></FieldIcon>
                    <input type="text" aria-label="Registration number" value={form.registrationNumber} onChange={(e) => handleChange('registrationNumber', e.target.value)} placeholder="Enter registration number" className={iconInputClass('registrationNumber')} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Phone</label>
                  <div className="relative">
                    <FieldIcon><FiPhone className="h-4 w-4" /></FieldIcon>
                    <input type="tel" aria-label="Phone" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+260..." className={iconInputClass('phone')} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email</label>
                  <div className="relative">
                    <FieldIcon><FiMail className="h-4 w-4" /></FieldIcon>
                    <input type="email" aria-label="Email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="email@example.com" className={iconInputClass('email')} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Website</label>
                  <div className="relative">
                    <FieldIcon><FiGlobe className="h-4 w-4" /></FieldIcon>
                    <input type="url" aria-label="Website" value={form.website} onChange={(e) => handleChange('website', e.target.value)} placeholder="www.example.com" className={iconInputClass('website')} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Default Currency <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <FieldIcon><FiDollarSign className="h-4 w-4" /></FieldIcon>
                    <select aria-label="Default currency" aria-invalid={Boolean(errors.currency)} value={form.currency} onChange={(e) => handleChange('currency', e.target.value)} className={iconInputClass('currency')}>
                      <option value="">Select currency</option>
                      <option value="ZMW">ZMW - Zambian Kwacha</option>
                      <option value="USD">USD - US Dollar</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="EUR">EUR - Euro</option>
                    </select>
                  </div>
                  {errors.currency && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.currency}</p>}
                </div>
              </div>

              <div className="mt-7 space-y-5">
                <div>
                  <label className={labelClass}>Address Line 1</label>
                  <div className="relative">
                    <FieldIcon><FiMapPin className="h-4 w-4" /></FieldIcon>
                    <input type="text" aria-label="Address line 1" value={form.addressLine1} onChange={(e) => handleChange('addressLine1', e.target.value)} placeholder="Address Line 1" className={iconInputClass('addressLine1')} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Address Line 2 <span className="font-normal text-slate-400">(Optional)</span></label>
                  <div className="relative">
                    <FieldIcon><FiMapPin className="h-4 w-4" /></FieldIcon>
                    <input type="text" aria-label="Address line 2" value={form.addressLine2} onChange={(e) => handleChange('addressLine2', e.target.value)} placeholder="Address Line 2" className={iconInputClass('addressLine2')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Town / City</label>
                    <div className="relative">
                      <FieldIcon><FiMapPin className="h-4 w-4" /></FieldIcon>
                      <input type="text" aria-label="Town or city" value={form.townCity} onChange={(e) => handleChange('townCity', e.target.value)} placeholder="Town/City" className={iconInputClass('townCity')} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Country</label>
                    <div className="relative">
                      <FieldIcon><FiGlobe className="h-4 w-4" /></FieldIcon>
                      <input type="text" aria-label="Country" value={form.country} onChange={(e) => handleChange('country', e.target.value)} placeholder="Country" className={iconInputClass('country')} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                {isEditing ? <button type="button" onClick={handleCancel} className="ui-secondary-button">Cancel</button> : <span />}
                <button type="button" onClick={handleContinue} className="ui-primary-button min-w-32">Continue <FiArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-4 sm:p-7 lg:p-9">
              <div className="mb-6">
                <h2 className="text-xl font-bold tracking-[-0.015em] text-slate-950">Review & Save</h2>
                <p className="mt-1 text-sm text-slate-500">Confirm the information that will appear on your documents.</p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {form.logo ? <img src={form.logo} alt="Logo" className="h-full w-full object-cover" /> : <FiCamera className="h-8 w-8 text-slate-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="break-anywhere text-lg font-bold text-slate-950">{form.name || 'Unnamed Business'}</p>
                      <p className="mt-1 text-sm capitalize text-slate-500">{form.type ? form.type.replace(/_/g, ' ') : 'Business type not specified'}</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl bg-primary-50 p-4 text-sm text-primary-900">
                    <p className="font-semibold">Default document currency</p>
                    <p className="mt-1 text-primary-700">{form.currency}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      {label: 'TPIN', value: form.tpin, icon: FiCreditCard},
                      {label: 'Registration', value: form.registrationNumber, icon: FiFileText},
                      {label: 'Phone', value: form.phone, icon: FiPhone},
                      {label: 'Email', value: form.email, icon: FiMail},
                      {label: 'Website', value: form.website, icon: FiGlobe},
                      {label: 'Town / City', value: form.townCity, icon: FiMapPin},
                      {label: 'Country', value: form.country, icon: FiGlobe},
                      {label: 'Address', value: [form.addressLine1, form.addressLine2].filter(Boolean).join(', '), icon: FiMapPin},
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm"><Icon className="h-4 w-4" /></span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-400">{item.label}</p>
                            <p className="mt-0.5 break-anywhere text-sm font-semibold text-slate-800">{item.value || '—'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setStep(1)} className="ui-secondary-button"><FiArrowLeft className="h-4 w-4" /> Back</button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {isEditing && <button type="button" onClick={handleCancel} className="ui-secondary-button"><FiX className="h-4 w-4" /> Cancel</button>}
                  <button type="button" onClick={handleSave} className="ui-primary-button"><FiSave className="h-4 w-4" /> Save & Continue</button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
