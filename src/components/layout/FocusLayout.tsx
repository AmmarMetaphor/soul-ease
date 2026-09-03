import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { cn } from '@/lib/cn';

/**
 * Minimal chrome for onboarding and other single-task flows.
 */
export function FocusLayout({
  children,
  right,
  className,
  logoTo,
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
  logoTo?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo to={logoTo} />
        <div className="flex items-center gap-3">
          {right}
          <LanguageSwitcher />
        </div>
      </header>
      <main className={cn('mx-auto w-full max-w-3xl flex-1 px-5 pb-16 sm:px-8', className)}>{children}</main>
    </div>
  );
}
