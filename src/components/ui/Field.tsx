import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

const baseControl =
  'w-full rounded-xl border border-ink-900/10 bg-white px-4 text-ink-900 placeholder:text-ink-300 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-ivory-100 disabled:text-ink-500 aria-[invalid=true]:border-danger-600';

interface FieldWrapperProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ id, label, hint, error, children, className }: FieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, wrapperClassName, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldWrapper id={inputId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <input
        ref={ref}
        id={inputId}
        className={cn(baseControl, 'h-12', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, wrapperClassName, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldWrapper id={inputId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={inputId}
        className={cn(baseControl, 'min-h-[7rem] resize-y py-3 leading-relaxed', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, id, className, wrapperClassName, children, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldWrapper id={inputId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <select ref={ref} id={inputId} className={cn(baseControl, 'h-12 appearance-none', className)} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
});

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, id, className, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors hover:bg-ink-900/[0.03] has-[:disabled]:cursor-not-allowed',
        className,
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 rounded-md border-ink-900/20 text-emerald-700 accent-emerald-700 focus:ring-emerald-600"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-500">{description}</span>}
      </span>
    </label>
  );
});
