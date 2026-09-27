import type {ReactNode} from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export default function PageHeader({title, description, eyebrow, actions}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">{eyebrow}</p>}
        <h1 className="break-anywhere text-2xl font-bold tracking-[-0.02em] text-slate-950 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl break-anywhere text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </div>
  );
}
