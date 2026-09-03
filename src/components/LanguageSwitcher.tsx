import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';

export function LanguageSwitcher({ className, onChange }: { className?: string; onChange?: (locale: 'en' | 'ur') => void }) {
  const { locale, setLocale, t } = useI18n();
  const options: Array<{ value: 'en' | 'ur'; label: string }> = [
    { value: 'en', label: t('common.english') },
    { value: 'ur', label: t('common.urdu') },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t('common.language')}
      className={cn('inline-flex rounded-full bg-ink-900/5 p-0.5 text-sm', className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={locale === opt.value}
          lang={opt.value}
          onClick={() => {
            setLocale(opt.value);
            onChange?.(opt.value);
          }}
          className={cn(
            'rounded-full px-3 py-1 font-medium transition-colors',
            locale === opt.value ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-900',
            opt.value === 'ur' && 'font-urdu leading-none',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
