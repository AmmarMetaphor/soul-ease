import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** When true the dialog cannot be dismissed by backdrop or Escape. */
  blocking?: boolean;
}

/**
 * Accessible modal built on the native <dialog> element (focus trapping and
 * Escape handling come for free).
 */
export function Dialog({ open, onClose, title, description, children, footer, className, blocking }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (!blocking) onClose();
    };
    const onClick = (event: MouseEvent) => {
      if (blocking) return;
      if (event.target === el) onClose();
    };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('cancel', onCancel);
      el.removeEventListener('click', onClick);
    };
  }, [onClose, blocking]);

  return (
    <dialog
      ref={ref}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 text-ink-900 shadow-lift backdrop:bg-ink-900/40 backdrop:backdrop-blur-sm open:animate-fade-up',
        className,
      )}
      aria-labelledby="dialog-title"
    >
      <div className="p-6 sm:p-7">
        <h2 id="dialog-title" className="text-xl font-semibold">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>}
        {children && <div className="mt-4">{children}</div>}
        {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </dialog>
  );
}
