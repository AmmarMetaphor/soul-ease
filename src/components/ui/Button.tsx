import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-emerald-700 text-ivory-50 hover:bg-emerald-800 active:bg-emerald-800 shadow-soft disabled:bg-emerald-700/50',
  secondary:
    'bg-white text-ink-900 ring-1 ring-ink-900/10 hover:bg-ivory-50 active:bg-ivory-100 disabled:text-ink-300',
  soft: 'bg-sage-100 text-emerald-800 hover:bg-sage-200 active:bg-sage-200 disabled:text-ink-300',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-900/5 active:bg-ink-900/10 disabled:text-ink-300',
  danger: 'bg-danger-100 text-danger-600 hover:bg-danger-100/80 ring-1 ring-danger-600/20 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-2xl',
  xl: 'h-14 px-8 text-base gap-2.5 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  full?: boolean;
}

export const buttonClasses = (variant: Variant = 'primary', size: Size = 'md', full = false, extra?: string) =>
  cn(
    'inline-flex items-center justify-center font-semibold transition-colors duration-200 select-none',
    'disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory-100',
    VARIANTS[variant],
    SIZES[size],
    full && 'w-full',
    extra,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, leading, trailing, full, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses(variant, size, full, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : leading}
      <span>{children}</span>
      {!loading && trailing}
    </button>
  );
});

export interface LinkButtonProps {
  to: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function LinkButton({ to, variant, size, full, className, children, leading, trailing }: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClasses(variant, size, full, className)}>
      {leading}
      <span>{children}</span>
      {trailing}
    </Link>
  );
}
