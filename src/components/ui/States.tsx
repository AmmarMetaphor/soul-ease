import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, body, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-100 text-emerald-700">{icon}</div>}
      <p className="font-semibold text-ink-900">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm leading-relaxed text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({ message, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-2xl border border-danger-600/20 bg-danger-100/60 p-4 text-sm text-danger-600 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function InlineNotice({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'warn' | 'sage' | 'dusk';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'bg-ink-900/[0.04] text-ink-700',
    warn: 'bg-warn-100 text-warn-600',
    sage: 'bg-sage-100 text-emerald-800',
    dusk: 'bg-dusk-100 text-dusk-500',
  } as const;
  return <div className={cn('rounded-xl px-4 py-3 text-sm leading-relaxed', tones[tone], className)}>{children}</div>;
}
