import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { SendIcon } from '@/components/ui/Icons';
import { useT } from '@/i18n';

interface TextComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function TextComposer({ onSend, disabled, autoFocus }: TextComposerProps) {
  const t = useT();
  const [value, setValue] = useState('');

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl bg-white p-2 ring-1 ring-ink-900/10 focus-within:ring-2 focus-within:ring-emerald-600/40">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('session.typePlaceholder')}
        rows={1}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={t('session.typePlaceholder')}
        className="max-h-32 min-h-[2.75rem] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-300 focus:outline-none disabled:opacity-50"
        dir="auto"
      />
      <button
        type="submit"
        aria-label={t('session.send')}
        disabled={disabled || !value.trim()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-ivory-50 transition-colors hover:bg-emerald-800 disabled:bg-ink-300/40"
      >
        <SendIcon size={18} className="rtl:-scale-x-100" />
      </button>
    </form>
  );
}
