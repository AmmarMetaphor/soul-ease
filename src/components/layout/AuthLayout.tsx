import { Outlet } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { NoorOrb } from '@/components/brand/NoorOrb';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useT } from '@/i18n';

export function AuthLayout() {
  const t = useT();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-emerald-800 text-ivory-50 lg:flex lg:flex-col lg:justify-between lg:p-12 grain">
        <Logo className="text-ivory-50" />
        <div className="relative z-10 flex flex-col items-start gap-8">
          <NoorOrb state="ready" size="md" />
          <div className="max-w-md">
            <p className="font-display text-3xl font-light leading-snug">{t('common.supportingLine')}</p>
            <p className="mt-4 text-sm text-ivory-50/70">{t('common.tagline')}</p>
          </div>
        </div>
        <p className="relative z-10 text-xs text-ivory-50/60">{t('landing.honestyBody')}</p>
      </aside>
      <main className="flex flex-col px-5 py-6 sm:px-10 sm:py-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
