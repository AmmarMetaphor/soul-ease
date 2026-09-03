import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card p-5 sm:p-6', className)} {...rest}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ eyebrow, title, action, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      </div>
      {action}
    </div>
  );
}

interface LinkCardProps {
  to: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function LinkCard({ to, title, description, icon, meta, className }: LinkCardProps) {
  return (
    <Link
      to={to}
      className={cn(
        'card group flex items-start gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      {icon && (
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-emerald-700">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-900">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-500">{description}</span>}
        {meta && <span className="mt-2 block text-xs text-ink-500">{meta}</span>}
      </span>
      <svg
        className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
