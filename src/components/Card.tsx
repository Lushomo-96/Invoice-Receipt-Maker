import React from 'react';
import {cn} from '../utils/helpers';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({children, className, onClick}: CardProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]',
        onClick && 'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
