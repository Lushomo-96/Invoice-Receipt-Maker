import React from 'react';
import {useStore, useOnlineStatus} from '../store/useStore';
import {useLocation, useNavigate} from 'react-router-dom';
import {
  FiBox,
  FiChevronDown,
  FiCreditCard,
  FiFile,
  FiFileText,
  FiGrid,
  FiHome,
  FiMenu,
  FiMoreHorizontal,
  FiPieChart,
  FiSettings,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import {cn} from '../utils/helpers';

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{className?: string}>;
  path: string;
};

const primaryNav: NavItem[] = [
  {id: 'home', label: 'Dashboard', icon: FiHome, path: '/home'},
  {id: 'documents', label: 'Documents', icon: FiGrid, path: '/documents'},
  {id: 'invoices', label: 'Invoices', icon: FiFileText, path: '/invoices'},
  {id: 'receipts', label: 'Receipts', icon: FiFile, path: '/receipts'},
  {id: 'payments', label: 'Payments', icon: FiCreditCard, path: '/payments'},
  {id: 'customers', label: 'Customers', icon: FiUsers, path: '/customers'},
  {id: 'items', label: 'Products & Services', icon: FiBox, path: '/items'},
  {id: 'reports', label: 'Reports', icon: FiPieChart, path: '/reports'},
];

const secondaryNav: NavItem[] = [
  {id: 'settings', label: 'Settings', icon: FiSettings, path: '/settings'},
  {id: 'business', label: 'Business Setup', icon: FiGrid, path: '/business'},
];

const mobileNav: NavItem[] = [
  {id: 'home', label: 'Home', icon: FiHome, path: '/home'},
  {id: 'invoices', label: 'Invoices', icon: FiFileText, path: '/invoices'},
  {id: 'receipts', label: 'Receipts', icon: FiFile, path: '/receipts'},
  {id: 'payments', label: 'Payments', icon: FiCreditCard, path: '/payments'},
  {id: 'customers', label: 'Customers', icon: FiUsers, path: '/customers'},
];

const mobileMoreNav: NavItem[] = [
  {id: 'documents', label: 'Documents', icon: FiGrid, path: '/documents'},
  {id: 'quotations', label: 'Quotations', icon: FiFileText, path: '/quotations'},
  {id: 'items', label: 'Products & Services', icon: FiBox, path: '/items'},
  {id: 'reports', label: 'Reports', icon: FiPieChart, path: '/reports'},
  {id: 'settings', label: 'Settings', icon: FiSettings, path: '/settings'},
  {id: 'business', label: 'Business Setup', icon: FiGrid, path: '/business'},
];

function isDesktopActive(routePage: string, itemId: string): boolean {
  if (itemId === 'documents' && routePage === 'quotations') return true;
  return routePage === itemId;
}

export default function Layout({children}: {children: React.ReactNode}) {
  const {setCurrentPage, sidebarOpen, setSidebarOpen, isOnline, business} = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMoreOpen, setMobileMoreOpen] = React.useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  useOnlineStatus();

  const routePage = location.pathname.split('/')[1] || 'home';
  const mobileMoreActive = ['documents', 'quotations', 'items', 'reports', 'settings', 'business', 'payments'].includes(routePage);

  React.useEffect(() => {
    setCurrentPage(routePage);
    setMobileMoreOpen(false);
    window.requestAnimationFrame(() => mainRef.current?.focus({preventScroll: true}));
  }, [routePage, setCurrentPage]);

  const handleNavigate = (item: NavItem) => {
    setCurrentPage(item.id);
    navigate(item.path);
    setSidebarOpen(false);
    setMobileMoreOpen(false);
  };

  const initials = (business?.name || 'Business')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'B';

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = isDesktopActive(routePage, item.id);
    return (
      <button
        key={item.id}
        type="button"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => handleNavigate(item)}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          isActive
            ? 'bg-primary-50 text-primary-700 shadow-[inset_0_0_0_1px_rgba(91,52,245,0.06)]'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600')} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#f7f8fc] text-slate-900">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(17rem,88vw)] flex-col border-r border-slate-200/80 bg-white transition-transform duration-200 lg:static lg:z-auto lg:w-[16.25rem] lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="safe-area-top flex h-[78px] items-center justify-between px-5">
          <button type="button" onClick={() => navigate('/home')} className="flex min-w-0 items-center gap-3 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-[0_8px_22px_rgba(91,52,245,0.24)]">
              <FiFileText className="h-5 w-5 text-white" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-bold text-slate-950">Invoice &</span>
              <span className="block truncate text-[15px] font-bold text-slate-950">Receipt Maker</span>
            </span>
          </button>
          <button type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          <nav className="space-y-1" aria-label="Primary navigation">
            {primaryNav.map(renderNavItem)}
          </nav>
          <div className="my-4 border-t border-slate-200" />
          <nav className="space-y-1" aria-label="Account navigation">
            {secondaryNav.map(renderNavItem)}
          </nav>
        </div>

        {business && (
          <div className="m-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-sm font-bold text-primary-700">{initials}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{business.name}</p>
                <p className="truncate text-xs text-slate-500">{isOnline ? 'Business profile' : 'Offline mode'}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="safe-area-top z-30 flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/90 px-3 backdrop-blur sm:px-5 lg:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 lg:hidden">
              <FiMenu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <p className="truncate text-sm font-bold text-slate-950">Invoice & Receipt Maker</p>
              {!isOnline && <p className="text-[10px] font-medium text-amber-600">Offline</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="sr-only" role="status" aria-live="polite">{isOnline ? 'Online' : 'Offline'}</span>
            {!isOnline && <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:inline">Offline</span>}
            <button type="button" onClick={() => navigate('/business')} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-50 sm:gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-sm font-bold text-white shadow-sm">{initials}</span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-40 truncate text-sm font-semibold text-slate-900">{business?.name || 'Business'}</span>
                <span className="block text-xs text-slate-500">Business account</span>
              </span>
              <FiChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </button>
          </div>
        </header>

        <main id="main-content" ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-28 pt-4 outline-none sm:px-5 sm:pt-5 lg:px-7 lg:pb-8 lg:pt-6 xl:px-9">{children}</main>
      </div>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white/96 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const isActive = routePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleNavigate(item)}
              className={cn('flex min-w-0 flex-col items-center justify-center gap-1 px-1 pb-1 pt-2.5 text-[10px] font-medium', isActive ? 'text-primary-700' : 'text-slate-500')}
            >
              <Icon className={cn('h-5 w-5', isActive && 'fill-primary-50')} />
              <span className="w-full truncate text-center">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={mobileMoreOpen}
          aria-controls="mobile-more-menu"
          aria-haspopup="menu"
          onClick={() => setMobileMoreOpen((open) => !open)}
          className={cn('flex min-w-0 flex-col items-center justify-center gap-1 px-1 pb-1 pt-2.5 text-[10px] font-medium', mobileMoreActive || mobileMoreOpen ? 'text-primary-700' : 'text-slate-500')}
        >
          <FiMoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <>
          <button type="button" aria-label="Close more menu" className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" onClick={() => setMobileMoreOpen(false)} />
          <div id="mobile-more-menu" role="menu" aria-label="More navigation" className="fixed inset-x-3 bottom-[calc(4.8rem+env(safe-area-inset-bottom))] z-50 max-h-[min(70vh,30rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl lg:hidden">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">More</p>
            <div className="grid grid-cols-2 gap-1">
              {mobileMoreNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" role="menuitem" onClick={() => handleNavigate(item)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Icon className="h-5 w-5 text-primary-600" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
