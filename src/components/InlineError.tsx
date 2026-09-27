import type {ReactNode} from 'react';
import {FiAlertCircle, FiRefreshCw} from 'react-icons/fi';

interface InlineErrorProps {
  title?: string;
  description: string;
  action?: {label: string; onClick: () => void};
  icon?: ReactNode;
}

export default function InlineError({title = 'Something went wrong', description, action, icon}: InlineErrorProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 sm:p-6" role="alert">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm">
          {icon ?? <FiAlertCircle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-rose-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-rose-800/80 break-anywhere">{description}</p>
          {action && (
            <button type="button" onClick={action.onClick} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100">
              <FiRefreshCw className="h-4 w-4" /> {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
