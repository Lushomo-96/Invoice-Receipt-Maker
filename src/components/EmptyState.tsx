import type {ReactNode} from 'react';
import {FiArrowRight, FiInbox} from 'react-icons/fi';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {label: string; onClick: () => void};
  icon?: ReactNode;
}

export default function EmptyState({title, description, action, icon}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center sm:py-16">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary-100 bg-primary-50 text-primary-600 shadow-sm">
        {icon ?? <FiInbox className="h-7 w-7" />}
      </div>
      <h3 className="text-lg font-bold tracking-[-0.01em] text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action && <button type="button" onClick={action.onClick} className="ui-primary-button mt-5"><span>{action.label}</span><FiArrowRight /></button>}
    </div>
  );
}
