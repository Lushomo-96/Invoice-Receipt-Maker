import {useEffect, useId, useRef, useState} from 'react';
import {FiAlertTriangle, FiX} from 'react-icons/fi';
import {cn} from '../utils/helpers';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonHelpId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setReason('');
    const frame = window.requestAnimationFrame(() => {
      (reasonLabel ? reasonRef.current : cancelRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => previousFocusRef.current?.focus());
    };
  }, [open, onCancel, reasonLabel]);

  if (!open) return null;
  const disabled = reasonRequired && !reason.trim();

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:items-center" role="presentation">
      <div
        ref={dialogRef}
        className="max-h-[min(90dvh,46rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-primary-50 text-primary-600')} aria-hidden="true">
            <FiAlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-slate-950 break-anywhere">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-500 break-anywhere">{description}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close dialog" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><FiX /></button>
        </div>

        {reasonLabel && (
          <div className="mt-5">
            <label className="ui-label" htmlFor={`${reasonHelpId}-input`}>{reasonLabel}{reasonRequired ? ' *' : ''}</label>
            <textarea
              ref={reasonRef}
              id={`${reasonHelpId}-input`}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={reasonPlaceholder}
              className="ui-field min-h-24 resize-y"
              aria-required={reasonRequired}
              aria-describedby={reasonRequired ? reasonHelpId : undefined}
            />
            {reasonRequired && <p id={reasonHelpId} className="mt-1.5 text-xs text-slate-400">A reason is required for the audit trail.</p>}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="ui-secondary-button">{cancelLabel}</button>
          <button type="button" disabled={disabled} onClick={() => onConfirm(reason.trim())} className={cn('inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50', tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700')}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
