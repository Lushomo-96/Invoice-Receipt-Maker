import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {toast} from 'react-hot-toast';
import {FiBriefcase, FiCamera, FiCreditCard, FiDatabase, FiDollarSign, FiDownload, FiEdit2, FiFileText, FiPlus, FiSave, FiShield, FiTrash2, FiUpload, FiX} from 'react-icons/fi';
import {useStore} from '../../store/useStore';
import {cn} from '../../utils/helpers';
import {normalizeAppSettings} from '../../utils/settings';
import {createBackupEnvelope, downloadBackupFile, readBackupFile, type BackupEnvelope, type BackupSummary} from '../../utils/backup';
import type {Business, DocumentSettings, FinancialSettings, PaymentMethod} from '../../types';
import PageHeader from '../../components/PageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';

type SettingsTab = 'business' | 'documents' | 'financial' | 'payments' | 'data';

type PdfToggleKey = 'showBusinessLogo' | 'showBusinessTpin' | 'showCustomerTpin' | 'showPaymentDetails' | 'showPaidStamp';
const PDF_TOGGLE_OPTIONS: ReadonlyArray<{key: PdfToggleKey; label: string}> = [
  {key: 'showBusinessLogo', label: 'Show business logo on PDFs'},
  {key: 'showBusinessTpin', label: 'Show business TPIN on PDFs'},
  {key: 'showCustomerTpin', label: 'Show customer TPIN on invoices and quotations'},
  {key: 'showPaymentDetails', label: 'Show selected payment details on invoices'},
  {key: 'showPaidStamp', label: 'Show PAID IN FULL notice on paid invoices'},
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod['type'], string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  mtn_money: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  zamtel_money: 'Zamtel Kwacha',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

function emptyPaymentMethod(businessId = ''): PaymentMethod {
  return {
    id: '',
    businessId,
    type: 'cash',
    provider: '',
    phoneNumber: '',
    accountName: '',
    bankName: '',
    accountNumber: '',
    branch: '',
    swiftCode: '',
  };
}

function cloneBusiness(business: Readonly<Business> | null): Business | null {
  return business ? {...business} : null;
}

function trimBusiness(business: Business): Business {
  return Object.fromEntries(
    Object.entries(business).map(([key, value]) => [key, typeof value === 'string' && key !== 'logo' ? value.trim() : value]),
  ) as unknown as Business;
}

export default function Settings() {
  const navigate = useNavigate();
  const {business, setBusiness, settings, setSettings, paymentMethods, invoices, quotations, receipts, payments, items, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, getBackupData, restoreBackup} = useStore();
  const currencyLocked = invoices.length > 0 || quotations.length > 0 || receipts.length > 0 || payments.length > 0 || items.length > 0;
  const [activeTab, setActiveTab] = useState<SettingsTab>('business');
  const [businessDraft, setBusinessDraft] = useState<Business | null>(() => cloneBusiness(business));
  const [documentDraft, setDocumentDraft] = useState<DocumentSettings>(() => ({...settings.document}));
  const [financialDraft, setFinancialDraft] = useState<FinancialSettings>(() => ({...settings.financial}));
  const [paymentDraft, setPaymentDraft] = useState<PaymentMethod>(() => emptyPaymentMethod(business?.id));
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<{envelope: BackupEnvelope; summary: BackupSummary; fileName: string} | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<string | null>(null);

  useEffect(() => setBusinessDraft(cloneBusiness(business)), [business]);
  useEffect(() => setDocumentDraft({...settings.document}), [settings.document]);
  useEffect(() => setFinancialDraft({...settings.financial}), [settings.financial]);
  useEffect(() => {
    if (!editingPaymentMethodId) setPaymentDraft(emptyPaymentMethod(business?.id));
  }, [business?.id, editingPaymentMethodId]);

  const updateBusiness = <K extends keyof Business>(field: K, value: Business[K]) => {
    setBusinessDraft((previous) => previous ? {...previous, [field]: value} : previous);
  };

  const handleLogoUpload = (file: File | undefined) => {
    if (!file || !businessDraft) return;
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
      if (typeof reader.result === 'string') updateBusiness('logo', reader.result);
    };
    reader.onerror = () => toast.error('Unable to read that logo file.');
    reader.readAsDataURL(file);
  };

  const saveBusiness = () => {
    if (!businessDraft) return;
    const next = trimBusiness(businessDraft);
    if (!next.name) {
      toast.error('Business name is required.');
      return;
    }
    if (!next.currency) {
      toast.error('Default currency is required.');
      return;
    }
    const result = setBusiness(next);
    if (!result.success) {
      toast.error(result.error ?? 'Unable to save the business profile.');
      return;
    }
    setBusinessDraft(result.business ? {...result.business} : null);
    toast.success('Business profile saved.');
  };

  const saveDocumentSettings = () => {
    const normalized = normalizeAppSettings({
      document: documentDraft,
      financial: {...settings.financial},
    });
    setSettings(normalized);
    setDocumentDraft({...normalized.document});
    toast.success('Document settings saved.');
  };

  const saveFinancialSettings = () => {
    const normalized = normalizeAppSettings({
      document: {...settings.document},
      financial: financialDraft,
    });
    setSettings(normalized);
    setFinancialDraft({...normalized.financial});
    toast.success('Financial defaults saved.');
  };

  const resetPaymentDraft = () => {
    setEditingPaymentMethodId(null);
    setPaymentDraft(emptyPaymentMethod(business?.id));
  };

  const editPaymentMethod = (method: Readonly<PaymentMethod>) => {
    setEditingPaymentMethodId(method.id);
    setPaymentDraft({...method});
  };

  const savePaymentMethod = () => {
    const result = editingPaymentMethodId ? updatePaymentMethod(paymentDraft) : addPaymentMethod(paymentDraft);
    if (!result.success) {
      toast.error(result.error ?? 'Unable to save the payment method.');
      return;
    }
    toast.success(editingPaymentMethodId ? 'Payment method updated.' : 'Payment method added.');
    resetPaymentDraft();
  };

  const confirmRemovePaymentMethod = () => {
    if (!paymentMethodToDelete) return;
    const result = deletePaymentMethod(paymentMethodToDelete);
    if (!result.success) {
      toast.error(result.error ?? 'Unable to remove the payment method.');
      return;
    }
    if (editingPaymentMethodId === paymentMethodToDelete) resetPaymentDraft();
    setPaymentMethodToDelete(null);
    toast.success('Payment method removed.');
  };

  const exportBackup = () => {
    try {
      const envelope = createBackupEnvelope(getBackupData());
      downloadBackupFile(envelope, business?.name || 'business');
      toast.success('Backup downloaded.');
    } catch {
      toast.error('Unable to create the backup file.');
    }
  };

  const chooseRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = await readBackupFile(file);
    if (!parsed.success || !parsed.envelope || !parsed.summary) {
      setPendingRestore(null);
      setRestoreConfirmation('');
      toast.error(parsed.error ?? 'Unable to validate that backup.');
      return;
    }
    setPendingRestore({envelope: parsed.envelope, summary: parsed.summary, fileName: file.name});
    setRestoreConfirmation('');
  };

  const confirmRestore = () => {
    if (!pendingRestore || restoreConfirmation !== 'RESTORE') return;
    try {
      const safetyBackup = createBackupEnvelope(getBackupData());
      downloadBackupFile(safetyBackup, business?.name || 'business');
    } catch {
      toast.error('Could not create the required pre-restore safety backup. Restore was not started.');
      return;
    }
    const result = restoreBackup(pendingRestore.envelope.data);
    if (!result.success) {
      toast.error(result.error ?? 'Restore failed. Your current data was left unchanged.');
      return;
    }
    setPendingRestore(null);
    setRestoreConfirmation('');
    toast.success('Backup restored successfully.');
    navigate('/home');
  };

  const tabClass = (tab: SettingsTab) => cn(
    'shrink-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold capitalize whitespace-nowrap transition-colors',
    activeTab === tab ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
  );
  const inputClass = 'ui-field';
  const labelClass = 'ui-label';

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <PageHeader eyebrow="Administration" title="Settings" description="Manage business identity, document defaults, payment instructions and local data protection." />

      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" role="tablist" aria-label="Settings sections">
        <button type="button" role="tab" aria-selected={activeTab === 'business'} onClick={() => setActiveTab('business')} className={tabClass('business')}>Business</button>
        <button type="button" role="tab" aria-selected={activeTab === 'documents'} onClick={() => setActiveTab('documents')} className={tabClass('documents')}>Documents</button>
        <button type="button" role="tab" aria-selected={activeTab === 'financial'} onClick={() => setActiveTab('financial')} className={tabClass('financial')}>Financial</button>
        <button type="button" role="tab" aria-selected={activeTab === 'payments'} onClick={() => setActiveTab('payments')} className={tabClass('payments')}>Payment Methods</button>
        <button type="button" role="tab" aria-selected={activeTab === 'data'} onClick={() => setActiveTab('data')} className={tabClass('data')}>Data & Backup</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.045)] sm:p-6 lg:p-7">
        {activeTab === 'business' && (
          !businessDraft ? (
            <div className="text-center py-10">
              <FiBriefcase className="mx-auto text-3xl text-slate-300" />
              <p className="mt-3 text-sm text-slate-600">No business profile is configured.</p>
              <button type="button" onClick={() => navigate('/business')} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium">Set up business</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FiBriefcase className="w-5 h-5 text-primary-600" /> Business Profile</h3>
                <button type="button" onClick={() => navigate('/business')} className="text-sm font-medium text-primary-600 hover:text-primary-700">Open guided editor</button>
              </div>

              <div>
                <label className={labelClass}>Business Logo</label>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {businessDraft.logo ? <img src={businessDraft.logo} alt="Business logo" className="w-full h-full object-contain" /> : <FiCamera className="w-7 h-7 text-slate-400" />}
                  </div>
                  <input ref={logoInputRef} type="file" aria-label="Upload business logo" accept="image/png,image/jpeg" className="hidden" onChange={(event) => {handleLogoUpload(event.target.files?.[0]); event.currentTarget.value = '';}} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="px-3 py-2 ui-secondary-button">{businessDraft.logo ? 'Replace logo' : 'Upload logo'}</button>
                    {businessDraft.logo && <button type="button" onClick={() => updateBusiness('logo', '')} className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-red-600 hover:bg-red-50 flex items-center gap-1"><FiX /> Remove</button>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelClass}>Business Name *</label><input aria-label="Business name" value={businessDraft.name} onChange={(event) => updateBusiness('name', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Business Type</label><select aria-label="Business type" value={businessDraft.type} onChange={(event) => updateBusiness('type', event.target.value)} className={inputClass}><option value="">Select type</option><option value="sole_proprietorship">Sole Proprietorship</option><option value="partnership">Partnership</option><option value="private_company">Private Company</option><option value="public_company">Public Company</option><option value="non_profit">Non-Profit</option></select></div>
                <div><label className={labelClass}>TPIN</label><input aria-label="TPIN" value={businessDraft.tpin} onChange={(event) => updateBusiness('tpin', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Registration Number</label><input aria-label="Registration number" value={businessDraft.registrationNumber} onChange={(event) => updateBusiness('registrationNumber', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Tax Registration Number</label><input aria-label="Tax registration number" value={businessDraft.taxRegNumber} onChange={(event) => updateBusiness('taxRegNumber', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Additional Identifier</label><input aria-label="Additional identifier" value={businessDraft.additionalIdentifier} onChange={(event) => updateBusiness('additionalIdentifier', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Phone</label><input type="tel" aria-label="Business phone" value={businessDraft.phone} onChange={(event) => updateBusiness('phone', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Email</label><input type="email" aria-label="Business email" value={businessDraft.email} onChange={(event) => updateBusiness('email', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Website</label><input type="url" aria-label="Business website" value={businessDraft.website} onChange={(event) => updateBusiness('website', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Default Currency *</label><select aria-label="Default currency" disabled={currencyLocked} value={businessDraft.currency} onChange={(event) => updateBusiness('currency', event.target.value)} className={`${inputClass} ${currencyLocked ? 'cursor-not-allowed opacity-60' : ''}`}><option value="ZMW">ZMW - Zambian Kwacha</option><option value="USD">USD - US Dollar</option><option value="GBP">GBP - British Pound</option><option value="EUR">EUR - Euro</option></select>{currencyLocked && <p className="mt-1.5 text-xs text-slate-500">Locked because priced items or financial documents already exist.</p>}</div>
                <div className="md:col-span-2"><label className={labelClass}>Slogan</label><input aria-label="Business slogan" value={businessDraft.slogan} onChange={(event) => updateBusiness('slogan', event.target.value)} className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Address Line 1</label><input aria-label="Address line 1" value={businessDraft.addressLine1} onChange={(event) => updateBusiness('addressLine1', event.target.value)} className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Address Line 2</label><input aria-label="Address line 2" value={businessDraft.addressLine2} onChange={(event) => updateBusiness('addressLine2', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Town / City</label><input aria-label="Town or city" value={businessDraft.townCity} onChange={(event) => updateBusiness('townCity', event.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Country</label><input aria-label="Country" value={businessDraft.country} onChange={(event) => updateBusiness('country', event.target.value)} className={inputClass} /></div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="button" onClick={saveBusiness} className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 ui-primary-button"><FiSave /> Save Business Profile</button>
              </div>
            </div>
          )
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FiFileText className="w-5 h-5 text-primary-600" /> Document Settings</h3>
            <p className="text-sm text-slate-500">Numbering and date defaults apply only to documents created after you save these settings. Existing document numbers and dates are never rewritten.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelClass}>Invoice Prefix</label><input aria-label="Invoice prefix" value={documentDraft.invoicePrefix} onChange={(event) => setDocumentDraft((previous) => ({...previous, invoicePrefix: event.target.value.toUpperCase()}))} className={inputClass} maxLength={12} /><p className="mt-1 text-xs text-slate-400">Example: {documentDraft.invoicePrefix || 'INV'}-00001</p></div>
              <div><label className={labelClass}>Quotation Prefix</label><input aria-label="Quotation prefix" value={documentDraft.quotationPrefix} onChange={(event) => setDocumentDraft((previous) => ({...previous, quotationPrefix: event.target.value.toUpperCase()}))} className={inputClass} maxLength={12} /><p className="mt-1 text-xs text-slate-400">Example: {documentDraft.quotationPrefix || 'QUO'}-00001</p></div>
              <div><label className={labelClass}>Receipt Prefix</label><input aria-label="Receipt prefix" value={documentDraft.receiptPrefix} onChange={(event) => setDocumentDraft((previous) => ({...previous, receiptPrefix: event.target.value.toUpperCase()}))} className={inputClass} maxLength={12} /><p className="mt-1 text-xs text-slate-400">Example: {documentDraft.receiptPrefix || 'REC'}-00001</p></div>
              <div><label className={labelClass}>Default Invoice Terms</label><select aria-label="Default invoice terms" value={documentDraft.defaultInvoicePaymentTerms} onChange={(event) => setDocumentDraft((previous) => ({...previous, defaultInvoicePaymentTerms: event.target.value as DocumentSettings['defaultInvoicePaymentTerms']}))} className={inputClass}><option value="due_on_receipt">Due on Receipt</option><option value="7_days">7 Days</option><option value="14_days">14 Days</option><option value="30_days">30 Days</option></select></div>
              <div><label className={labelClass}>Quotation Validity (days)</label><input type="number" aria-label="Quotation validity days" min={1} max={365} value={documentDraft.defaultQuotationValidityDays} onChange={(event) => setDocumentDraft((previous) => ({...previous, defaultQuotationValidityDays: Number(event.target.value)}))} className={inputClass} /></div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              {PDF_TOGGLE_OPTIONS.map(({key, label}) => (
                <label key={key} className="flex items-center justify-between gap-4 py-1">
                  <span className="text-sm text-slate-700">{label}</span>
                  <input type="checkbox" checked={documentDraft[key]} onChange={(event) => setDocumentDraft((previous) => ({...previous, [key]: event.target.checked}))} />
                </label>
              ))}
            </div>

            <div className="flex sm:justify-end">
              <button type="button" onClick={saveDocumentSettings} className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 ui-primary-button"><FiSave /> Save Document Settings</button>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="space-y-6">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FiDollarSign className="w-5 h-5 text-primary-600" /> Financial Defaults</h3>
            <p className="text-sm text-slate-500">These are creation defaults for new invoice and quotation line items. Existing items and historical totals remain unchanged.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelClass}>Default Tax Rate (%)</label><input type="number" aria-label="Default tax rate" min={0} max={100} step="0.01" value={financialDraft.defaultTaxRate} onChange={(event) => setFinancialDraft((previous) => ({...previous, defaultTaxRate: Number(event.target.value)}))} className={inputClass} /></div>
              <label className="flex items-center justify-between gap-4 border border-slate-100 rounded-xl px-4 py-3 self-end"><span><span className="block text-sm font-medium text-slate-700">Tax inclusive by default</span><span className="block text-xs text-slate-500">New line-item prices will initially be treated as tax inclusive.</span></span><input type="checkbox" checked={financialDraft.defaultTaxInclusive} onChange={(event) => setFinancialDraft((previous) => ({...previous, defaultTaxInclusive: event.target.checked}))} /></label>
            </div>
            <div className="flex sm:justify-end">
              <button type="button" onClick={saveFinancialSettings} className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 ui-primary-button"><FiSave /> Save Financial Defaults</button>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FiCreditCard className="w-5 h-5 text-primary-600" /> Payment Methods</h3>
              <p className="mt-2 text-sm text-slate-500">Configure the payment details shown on future invoice PDFs. Historical payments and receipts keep their recorded method text even if a method is later edited or removed.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {paymentMethods.length === 0 ? (
                <div className="lg:col-span-2 border border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">No payment methods configured yet.</div>
              ) : paymentMethods.map((method) => {
                const locked = invoices.some((invoice) => invoice.paymentMethods.includes(method.id));
                return (
                  <div key={method.id} className="border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{PAYMENT_METHOD_LABELS[method.type]}</p>
                      {method.bankName && <p className="text-sm text-slate-600 break-anywhere">{method.bankName}{method.accountNumber ? ` • ${method.accountNumber}` : ''}</p>}
                      {method.phoneNumber && <p className="text-sm text-slate-600 break-anywhere">{method.phoneNumber}</p>}
                      {method.accountName && <p className="text-xs text-slate-500 break-anywhere">{method.accountName}</p>}
                      {locked && <p className="mt-1 text-xs text-amber-700">Locked by invoice history</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" disabled={locked} onClick={() => editPaymentMethod(method)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed" aria-label={`Edit ${PAYMENT_METHOD_LABELS[method.type]}`}><FiEdit2 /></button>
                      <button type="button" disabled={locked} onClick={() => setPaymentMethodToDelete(method.id)} className="p-2 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" aria-label={`Remove ${PAYMENT_METHOD_LABELS[method.type]}`}><FiTrash2 /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-medium text-slate-900">{editingPaymentMethodId ? 'Edit payment method' : 'Add payment method'}</h4>
                {editingPaymentMethodId && <button type="button" onClick={resetPaymentDraft} className="text-sm text-slate-500 hover:text-slate-800">Cancel edit</button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelClass}>Method Type</label><select aria-label="Payment method type" value={paymentDraft.type} onChange={(event) => setPaymentDraft((previous) => ({...emptyPaymentMethod(business?.id), id: previous.id, type: event.target.value as PaymentMethod['type']}))} className={inputClass}>{Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                {paymentDraft.type !== 'cash' && <div><label className={labelClass}>Account / Display Name</label><input aria-label="Account or display name" value={paymentDraft.accountName ?? ''} onChange={(event) => setPaymentDraft((previous) => ({...previous, accountName: event.target.value}))} className={inputClass} placeholder="e.g. Acme Ltd" /></div>}
                {paymentDraft.type === 'bank_transfer' && <>
                  <div><label className={labelClass}>Bank Name *</label><input aria-label="Bank name" value={paymentDraft.bankName ?? ''} onChange={(event) => setPaymentDraft((previous) => ({...previous, bankName: event.target.value}))} className={inputClass} /></div>
                  <div><label className={labelClass}>Account Number *</label><input aria-label="Account number" value={paymentDraft.accountNumber ?? ''} onChange={(event) => setPaymentDraft((previous) => ({...previous, accountNumber: event.target.value}))} className={inputClass} /></div>
                  <div><label className={labelClass}>Branch</label><input aria-label="Branch" value={paymentDraft.branch ?? ''} onChange={(event) => setPaymentDraft((previous) => ({...previous, branch: event.target.value}))} className={inputClass} /></div>
                  <div><label className={labelClass}>SWIFT Code</label><input aria-label="SWIFT code" value={paymentDraft.swiftCode ?? ''} onChange={(event) => setPaymentDraft((previous) => ({...previous, swiftCode: event.target.value.toUpperCase()}))} className={inputClass} /></div>
                </>}
                {['mtn_money', 'airtel_money', 'zamtel_money'].includes(paymentDraft.type) && <div><label className={labelClass}>Mobile Number *</label><input type="tel" aria-label="Mobile number" value={paymentDraft.phoneNumber ?? ''} onChange={(event) => setPaymentDraft((previous) => ({...previous, phoneNumber: event.target.value}))} className={inputClass} /></div>}
                {['card', 'cheque', 'other'].includes(paymentDraft.type) && <div><label className={labelClass}>Provider / Description</label><input aria-label="Provider or description" value={paymentDraft.provider ?? ''} onChange={(event) => setPaymentDraft((previous) => ({...previous, provider: event.target.value}))} className={inputClass} /></div>}
              </div>
              <button type="button" onClick={savePaymentMethod} disabled={!business} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 ui-primary-button disabled:opacity-40 disabled:cursor-not-allowed"><FiPlus /> {editingPaymentMethodId ? 'Save Payment Method' : 'Add Payment Method'}</button>
              {!business && <p className="text-sm text-amber-700">Set up a business profile before adding payment methods.</p>}
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2"><FiDatabase className="w-5 h-5 text-primary-600" /> Data & Backup</h3>
              <p className="mt-2 text-sm text-slate-500">Your app data is stored locally in this browser. Download regular backups so you can restore after changing devices, clearing browser storage, or reinstalling the app.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3"><FiDownload className="mt-0.5 text-primary-600" /><div><p className="font-medium text-slate-900">Download backup</p><p className="text-sm text-slate-500">Exports business details, settings, customers, items, invoices, quotations, payments, receipts, payment methods, and notifications.</p></div></div>
                <button type="button" onClick={exportBackup} className="inline-flex items-center gap-2 px-4 py-2 ui-primary-button"><FiDownload /> Download Backup</button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3"><FiUpload className="mt-0.5 text-primary-600" /><div><p className="font-medium text-slate-900">Restore backup</p><p className="text-sm text-slate-500">The file is validated before restore. Restore replaces the current local business dataset only after confirmation.</p></div></div>
                <input ref={restoreInputRef} type="file" aria-label="Choose backup JSON file" accept="application/json,.json" className="hidden" onChange={(event) => {void chooseRestoreFile(event.target.files?.[0]); event.currentTarget.value = '';}} />
                <button type="button" onClick={() => restoreInputRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 ui-secondary-button"><FiUpload /> Choose Backup File</button>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4">
              <FiShield className="mt-0.5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">Backups include financial and customer information in readable JSON. Store backup files securely. The integrity checksum detects accidental modification but is not encryption or a digital signature.</p>
            </div>

            {pendingRestore && (
              <div className="border-2 border-red-100 bg-red-50/40 rounded-xl p-4 space-y-4">
                <div>
                  <p className="font-semibold text-slate-900">Validated backup ready to restore</p>
                  <p className="mt-1 text-xs text-slate-500 break-all">{pendingRestore.fileName}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div><span className="block text-slate-500">Business</span><span className="font-medium text-slate-900">{pendingRestore.summary.businessName}</span></div>
                  <div><span className="block text-slate-500">Currency</span><span className="font-medium text-slate-900">{pendingRestore.summary.currency}</span></div>
                  <div><span className="block text-slate-500">Invoices</span><span className="font-medium text-slate-900">{pendingRestore.summary.invoices}</span></div>
                  <div><span className="block text-slate-500">Quotations</span><span className="font-medium text-slate-900">{pendingRestore.summary.quotations}</span></div>
                  <div><span className="block text-slate-500">Customers</span><span className="font-medium text-slate-900">{pendingRestore.summary.customers}</span></div>
                  <div><span className="block text-slate-500">Items</span><span className="font-medium text-slate-900">{pendingRestore.summary.items}</span></div>
                  <div><span className="block text-slate-500">Payments</span><span className="font-medium text-slate-900">{pendingRestore.summary.payments}</span></div>
                  <div><span className="block text-slate-500">Receipts</span><span className="font-medium text-slate-900">{pendingRestore.summary.receipts}</span></div>
                </div>
                <p className="text-sm text-red-700">A safety backup of your current data will be downloaded first. Then this backup will replace the current local dataset atomically.</p>
                <div>
                  <label className={labelClass}>Type RESTORE to confirm</label>
                  <input value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} className={inputClass} autoComplete="off" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={confirmRestore} disabled={restoreConfirmation !== 'RESTORE'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">Restore and Replace Data</button>
                  <button type="button" onClick={() => {setPendingRestore(null); setRestoreConfirmation('');}} className="px-4 py-2 ui-secondary-button">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(paymentMethodToDelete)}
        title="Remove payment method?"
        description="This removes the method from future payment instructions. Historical invoices and recorded payment text remain unchanged."
        confirmLabel="Remove Method"
        onCancel={() => setPaymentMethodToDelete(null)}
        onConfirm={() => confirmRemovePaymentMethod()}
      />
    </div>
  );
}
