import {FiArrowLeft, FiHome, FiMapPin} from 'react-icons/fi';
import {useNavigate} from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-[58vh] max-w-xl items-center justify-center py-8">
      <div className="w-full rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-soft sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600" aria-hidden="true"><FiMapPin className="h-6 w-6" /></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-primary-600">Page not found</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-slate-950">This screen does not exist.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">The link may be outdated, incomplete, or from an older app version. No financial records were changed.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => navigate(-1)} className="ui-secondary-button"><FiArrowLeft /> Go back</button>
          <button type="button" onClick={() => navigate('/home', {replace: true})} className="ui-primary-button"><FiHome /> Dashboard</button>
        </div>
      </div>
    </div>
  );
}
