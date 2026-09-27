import {useEffect, useState} from 'react';
import {useLocation} from 'react-router-dom';

const routeNames: Record<string, string> = {
  '/home': 'Dashboard',
  '/documents': 'Documents',
  '/invoices': 'Invoices',
  '/receipts': 'Receipts',
  '/quotations': 'Quotations',
  '/payments': 'Payments',
  '/customers': 'Customers',
  '/items': 'Products and Services',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/business': 'Business Setup',
};

function titleForPath(pathname: string) {
  const exact = routeNames[pathname];
  if (exact) return exact;
  const base = Object.keys(routeNames).find((path) => path !== '/home' && pathname.startsWith(`${path}/`));
  if (!base) return 'Invoice & Receipt Maker';
  if (pathname.endsWith('/new')) return `New ${routeNames[base]}`;
  if (pathname.endsWith('/edit')) return `Edit ${routeNames[base]}`;
  if (pathname.includes('/preview/')) return 'Invoice Preview';
  return `${routeNames[base]} details`;
}

export default function RouteAnnouncer() {
  const {pathname} = useLocation();
  const [message, setMessage] = useState('');

  useEffect(() => {
    const title = titleForPath(pathname);
    document.title = `${title} · Invoice & Receipt Maker`;
    setMessage(`${title} screen loaded`);
  }, [pathname]);

  return <div className="sr-only" aria-live="polite" aria-atomic="true">{message}</div>;
}
