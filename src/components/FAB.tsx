import {useEffect, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {FiPlus, FiFileText, FiFile, FiUser, FiBox} from 'react-icons/fi';
import {useStore} from '../store/useStore';

const menuItems = [
  {id: 'invoices', label: 'Invoice', icon: FiFileText, path: '/invoices/new'},
  {id: 'receipts', label: 'Receipt', icon: FiFileText, path: '/receipts/new'},
  {id: 'quotations', label: 'Quotation', icon: FiFile, path: '/quotations/new'},
  {id: 'customers', label: 'Customer', icon: FiUser, path: '/customers/new'},
  {id: 'items', label: 'Product / Service', icon: FiBox, path: '/items/new'},
];

const fabRoutes = new Set(['/documents', '/customers', '/items', '/invoices', '/quotations', '/receipts']);

export default function FAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => firstActionRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!fabRoutes.has(location.pathname)) return null;

  const handleAction = (path: string, page: string) => {
    setCurrentPage(page);
    navigate(path);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-[calc(5.3rem+env(safe-area-inset-bottom))] right-4 z-40 lg:bottom-8 lg:right-8">
      {open && (
        <>
          <button type="button" aria-label="Close quick-create menu" className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div id="quick-create-menu" role="menu" aria-label="Quick create" className="absolute bottom-20 right-0 z-50 max-h-[min(70dvh,26rem)] w-[min(15rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            {menuItems.map((item, index) => (
              <button ref={index === 0 ? firstActionRef : undefined} key={item.id} type="button" role="menuitem" onClick={() => handleAction(item.path, item.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-700 transition-colors hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50" aria-hidden="true"><item.icon className="h-4.5 w-4.5 text-primary-600" /></span>
                <span className="min-w-0 break-anywhere text-sm font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <button ref={triggerRef} type="button" aria-label={open ? 'Close quick-create menu' : 'Open quick-create menu'} aria-expanded={open} aria-controls="quick-create-menu" aria-haspopup="menu" onClick={() => setOpen(!open)} className="relative z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-[0_12px_28px_rgba(91,52,245,0.30)] transition-all hover:-translate-y-0.5 active:translate-y-0">
        <FiPlus className={`text-2xl transition-transform duration-200 ${open ? 'rotate-45' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}
