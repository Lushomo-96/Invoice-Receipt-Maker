import {lazy, Suspense} from 'react';
import {Navigate, Outlet, Route, Routes} from 'react-router-dom';
import {Toaster} from 'react-hot-toast';
import Layout from './components/Layout';
import FAB from './components/FAB';
import PageLoading from './components/PageLoading';
import RouteAnnouncer from './components/RouteAnnouncer';
import NotFound from './pages/NotFound';
import {useStore} from './store/useStore';

const Home = lazy(() => import('./pages/Home'));
const BusinessSetup = lazy(() => import('./pages/BusinessSetup'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/Customers/CustomerDetail'));
const CustomerForm = lazy(() => import('./pages/Customers/CustomerForm'));
const Items = lazy(() => import('./pages/Items'));
const ItemForm = lazy(() => import('./pages/Items/ItemForm'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceForm = lazy(() => import('./pages/Invoices/InvoiceForm'));
const InvoiceDetail = lazy(() => import('./pages/Invoices/InvoiceDetail'));
const InvoicesPreview = lazy(() => import('./pages/Invoices/InvoicesPreview'));
const Quotations = lazy(() => import('./pages/Quotations'));
const QuotationForm = lazy(() => import('./pages/Quotations/QuotationForm'));
const QuotationDetail = lazy(() => import('./pages/Quotations/QuotationDetail'));
const Receipts = lazy(() => import('./pages/Receipts'));
const ReceiptForm = lazy(() => import('./pages/Receipts/ReceiptForm'));
const ReceiptDetail = lazy(() => import('./pages/Receipts/ReceiptDetail'));
const Documents = lazy(() => import('./pages/Documents'));
const Payments = lazy(() => import('./pages/Payments'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));

function ProtectedLayout() {
  const business = useStore((state) => state.business);

  if (!business) return <Navigate to="/business" replace />;

  return (
    <Layout>
      <Outlet />
      <FAB />
    </Layout>
  );
}

function App() {
  return (
    <>
      <RouteAnnouncer />
      <Suspense fallback={<div className="min-h-[100dvh] bg-[#f7f8fc] p-4 sm:p-6 lg:p-8"><PageLoading /></div>}>
        <Routes>
          <Route path="/business" element={<BusinessSetup />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />

            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />

            <Route path="/items" element={<Items />} />
            <Route path="/items/new" element={<ItemForm />} />
            <Route path="/items/:id" element={<ItemForm />} />
            <Route path="/items/:id/edit" element={<ItemForm />} />

            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceForm />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
            <Route path="/invoices/preview/:id" element={<InvoicesPreview />} />

            <Route path="/quotations" element={<Quotations />} />
            <Route path="/quotations/new" element={<QuotationForm />} />
            <Route path="/quotations/:id" element={<QuotationDetail />} />
            <Route path="/quotations/:id/edit" element={<QuotationForm />} />

            <Route path="/receipts" element={<Receipts />} />
            <Route path="/receipts/new" element={<ReceiptForm />} />
            <Route path="/receipts/:id" element={<ReceiptDetail />} />

            <Route path="/documents" element={<Documents />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reports" element={<Reports />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>

      <Toaster
        position="bottom-center"
        containerClassName="app-toaster"
        toastOptions={{
          duration: 4000,
          style: {borderRadius: '12px', padding: '12px 16px', fontSize: '14px', maxWidth: 'min(92vw, 420px)'},
          success: {iconTheme: {primary: '#16a34a', secondary: '#fff'}},
          error: {iconTheme: {primary: '#ef4444', secondary: '#fff'}},
        }}
      />
    </>
  );
}

export default App;
