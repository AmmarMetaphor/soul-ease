import type { UiLocale } from '@/data/types';

const LOCALE_TAG: Record<UiLocale, string> = { en: 'en-PK', ur: 'ur-PK' };

export function formatDate(iso: string, locale: UiLocale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string, locale: UiLocale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) return '—';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes} min`;
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function relativeDay(iso: string, locale: UiLocale = 'en'): string {
  const then = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((now.setHours(0, 0, 0, 0) - new Date(then).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays === 0) return locale === 'ur' ? 'آج' : 'Today';
  if (diffDays === 1) return locale === 'ur' ? 'کل' : 'Yesterday';
  return formatDate(iso, locale);
}
