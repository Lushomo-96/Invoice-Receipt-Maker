import {cn} from '../utils/helpers';

const statusStyles: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  sent: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  unpaid: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  partially_paid: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  outstanding: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  voided: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  reversed: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-600/10',
  draft: 'bg-slate-100 text-slate-700 ring-slate-600/10',
  expired: 'bg-orange-50 text-orange-700 ring-orange-600/10',
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export default function StatusBadge({status, label, className}: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset', statusStyles[normalized] ?? statusStyles.draft, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {(label ?? status).replaceAll('_', ' ')}
    </span>
  );
}
